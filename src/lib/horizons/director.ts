import type { Verse } from "../quran/types";
import { SIGNS, isSign, type LandKey, type Landmark, type SignDef, type SignId, type SkyKey } from "./signs";
import type { Region, Score } from "./score";

/**
 * The director: a surah's score and its recitation, made into one unbroken
 * shot.
 *
 * Everything the world shows is a function of one number — how far into the
 * surah's recitation the film is — so the film can be scrubbed, looped and
 * resumed and is always at the same place for the same word. That number is
 * *film time*: seconds into the surah as the reciter's own word timings lay
 * it out. The player's clock is read into it (`timeOf`), and from it come the
 * sky (`sky`), where the camera is (`camera`), and — laid out once, before
 * the first frame — the land (`strip`).
 *
 * ── the land is the surah ahead ──────────────────────────────────────────
 *
 * The camera never cuts and the land is never remade under it. Instead the
 * whole surah is laid out along the camera's line before it begins: the
 * stretch of land the camera will be over when the reciter reaches a word is
 * made of what that word names. So the sea of 16:14 is a coastline on the
 * horizon while 16:13 is recited, and the camera is out over the water as
 * "the sea" is said. The surah ahead is the land ahead.
 *
 * It follows that every ayah has a place in the land, always the same place:
 * looping a passage to learn it flies the same stretch of country again and
 * again, which is how the memory palaces of old worked — the ayah is put
 * somewhere, and found there.
 *
 * ── the sky is now ───────────────────────────────────────────────────────
 *
 * The sky changes where the camera is, as weather does. Its hour only ever
 * runs forward — a word naming the night, at noon, brings on the evening and
 * then the night — so every change of light is a real dusk or a real dawn.
 * The film begins at the hour it is where the viewer is, under the moon as it
 * is tonight.
 */

export const SKY_KEYS: SkyKey[] = [
  "cloud", "rain", "storm", "hail", "wind", "stars", "moon", "phase", "sun", "haze", "revive", "dry",
  "mirage", "fire", "meteor", "alt", "gaze", "speed", "under", "lamp", "veil", "look", "bow", "sweep", "dim", "space",
];

/** The land, as the three strip textures carry it, four to a texture. */
export const LAND_KEYS: LandKey[] = [
  "sea", "mount", "dune", "coast",
  "fields", "trees", "palms", "river",
  "harrah", "seam", "strata", "straight",
  "city", "old",
];

export type SkyState = Record<SkyKey, number> & { hour: number };

/** What the sky is when no sign is holding it. */
const BASE: Record<SkyKey, number> = {
  cloud: 0.16, rain: 0, storm: 0, hail: 0, wind: 0.22, stars: 0.35, moon: 0, phase: 0.5, sun: 0.15,
  haze: 0.2, revive: 0.32, dry: 0.12, mirage: 0, fire: 0, meteor: 0, alt: 0.12, gaze: 0, speed: 1,
  under: 0, lamp: 0, veil: 0, look: 0, bow: 0, sweep: 0, dim: 0, space: 0,
};

/** What each region is made of. */
const REGION_LAND: Record<Region, Partial<Record<LandKey, number>>> = {
  mountains: { mount: 0.85 },
  dunes: { dune: 0.95 },
  harrah: { harrah: 0.9, mount: 0.32 },
  coast: { coast: 1, dune: 0.25 },
  plains: { fields: 0.4 },
  oasis: { palms: 0.8, fields: 0.75, river: 0.1 },
};

/** Seconds of film after the last ayah: the camera rises, and the niche closes. */
export const OUTRO = 26;
/** How far ahead of the word the land it names begins: the camera crosses into it as the word is said. */
const LEAD = 3;
/** The quickest the sky's hour is let run, in hours a second. */
const MAX_RATE = 2.6;
/** The day passes by itself too, slowly: an hour in every two and a half minutes of recitation. */
const DRIFT = 1 / 150;
/** Ground speed, metres a second, at the camera's lowest. */
const V0 = 30;
const GRID = 0.25;

/** Signs of the sky that are only seen by day, beside the signs of the land. */
const DAYLIGHT = new Set<string>([
  "cloud", "rain", "drizzle", "wind", "gale", "hail", "plants", "crops", "grain", "sprout", "harvest", "green",
  "pasture", "dry", "lifecycle", "revive", "earthSpread", "clearing", "calm",
]);

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The camera's line across the land. Kept in step with `pathX` in world.glsl.ts. */
export function pathX(z: number, straight: number): number {
  const w = 120 * Math.sin(z * 0.0011) + 55 * Math.sin(z * 0.0027 + 1.3) + 18 * Math.sin(z * 0.0061 + 0.4);
  return w * (1 - straight);
}

/** The floor of the land under the camera's line. Kept in step with `floorOf` in world.glsl.ts. */
export function floorOf(sea: number, mount: number, dune: number, harrah: number, river: number): number {
  return 6 - 26 * sea + 24 * mount + 5 * dune + 4 * harrah - 9 * river * (1 - sea);
}

export function undulation(z: number): number {
  return 2.2 * Math.sin(z * 0.0057) + 1.4 * Math.sin(z * 0.0131 + 2.0);
}

/** How high the camera is when it has left the air: above the Kármán line, in low orbit. */
export const SPACE_HEIGHT = 380000;

/** A landmark set on the land: its kind, and where its foot stands. */
export interface PlacedLandmark {
  kind: Landmark;
  x: number;
  y: number;
  z: number;
}

/** Metres above the ground for a value of `alt`. */
export function altitude(alt: number): number {
  return 14 * Math.pow(650, Math.max(0, Math.min(1, alt)));
}

interface Event {
  t: number;
  until: number;
  ramp: number;
  release: number;
  sky?: Partial<Record<SkyKey, number>>;
  land?: Partial<Record<LandKey, number>>;
}

interface HourStep {
  t0: number;
  t1: number;
  delta: number;
}

/** A sign the film shows a word for: when, which word, which sign. */
export interface Caption {
  t: number;
  ayah: number;
  position: number;
  sign: SignId;
}

export interface CameraState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  /** Metres above the ground, for the shader's horizon. */
  height: number;
}

export interface Timing {
  key: string;
  start: number;
  duration: number;
  /** Seconds into the ayah at which each word begins, by position from 1. */
  words: number[];
}

/**
 * How an ayah is laid out in time before its recording has been heard: the
 * corpus's word timings for this reciter, and the end of the last word, which
 * falls within a breath of the end of the recording.
 */
function timingsOf(verses: Verse[]): Timing[] {
  let start = 0;
  return verses.map((v) => {
    const count = v.words?.filter((w) => w.char_type_name === "word").length || v.text_uthmani.split(" ").length;
    const segments = v.audio?.segments ?? [];
    const words: number[] = [];
    let end = 0;
    for (const [, pos, s, e] of segments) {
      if (pos >= 1 && words[pos - 1] === undefined) words[pos - 1] = s / 1000;
      end = Math.max(end, e / 1000);
    }
    const duration = end > 0 ? end + 0.45 : Math.max(2.5, count * 0.62);
    // A word the timings miss is put between its neighbours.
    for (let i = 0; i < count; i++) {
      if (words[i] !== undefined) continue;
      const before = i > 0 ? words[i - 1] : 0;
      let j = i + 1;
      while (j < count && words[j] === undefined) j++;
      const after = j < count ? words[j] : duration;
      words[i] = before + ((after - before) * 1) / (j - i + 1);
    }
    const t: Timing = { key: v.verse_key, start, duration, words };
    start += duration;
    return t;
  });
}

export interface FilmOptions {
  /** The hour the film begins at: the viewer's own, by default. */
  hour: number;
  /** The moon's phase tonight, 0 new to 0.5 full. */
  phase: number;
  /** How fast the camera travels, against its usual pace: slower for a viewer who wants calm. */
  pace?: number;
}

export class Film {
  readonly surah: number;
  readonly timings: Timing[];
  readonly duration: number;
  readonly captions: Caption[] = [];
  /** The places drawn as they stand, set on the land where the camera will be. */
  readonly landmarks: PlacedLandmark[] = [];
  /** The land along the camera's line: four RGBA rows of `width` texels, `dz` metres apart. */
  readonly strip: { data: Float32Array[]; width: number; dz: number };

  private readonly skyEvents: Event[] = [];
  /** The stretches the world is veiled for, `[from, to]` in film time. */
  private readonly veils: [number, number][] = [];
  private readonly landEvents: Event[] = [];
  /** Landmarks named, waiting for the camera's path to be known to be set on it. */
  private readonly pendingMarks: { kind: Landmark; at: number }[] = [];
  private readonly hours: HourStep[] = [];
  private readonly hour0: number;
  private readonly regions: { t0: number; t1: number; land: Partial<Record<LandKey, number>> }[] = [];
  private readonly base: Record<SkyKey, number>;
  /** Distance along the line at each step of GRID seconds. */
  private readonly zGrid: Float64Array;
  /** The straightness of the line, sampled with the strip, for the camera. */
  private readonly landGrid: Float32Array[];

  constructor(score: Score, verses: Verse[], options: FilmOptions) {
    this.surah = score.surah;
    this.timings = timingsOf(verses);
    const last = this.timings[this.timings.length - 1];
    const recited = last ? last.start + last.duration : 0;
    this.duration = recited + OUTRO;
    this.hour0 = options.hour;
    this.base = { ...BASE, phase: options.phase };

    this.score(score);
    this.layRegions(score);

    // The outro: up towards the stars.
    this.skyEvents.push({ t: recited + 1, until: Infinity, ramp: 14, release: 1, sky: { alt: 0.62, gaze: 0.5, speed: 0.5 } });

    // ── distance along the line, by film time ─────────────────────────────
    const steps = Math.ceil((this.duration + 60) / GRID) + 2;
    this.zGrid = new Float64Array(steps);
    const pace = options.pace ?? 1;
    let z = 0;
    for (let i = 0; i < steps; i++) {
      this.zGrid[i] = z;
      const s = this.skyAt(i * GRID - 30);
      z += V0 * pace * s.speed * (1 + 2.4 * s.alt * s.alt) * GRID;
    }

    // ── the land, laid out along it ───────────────────────────────────────
    const zEnd = this.zGrid[steps - 1];
    const width = Math.max(64, Math.min(8192, Math.ceil(zEnd / 10)));
    const dz = zEnd / (width - 1);
    const data = [0, 1, 2, 3].map(() => new Float32Array(width * 4));
    this.landGrid = data;
    for (let j = 0; j < width; j++) {
      const t = this.timeAtZ(j * dz) + LEAD;
      const land = this.landAt(t);
      LAND_KEYS.forEach((k, c) => {
        data[c >> 2][j * 4 + (c & 3)] = land[k];
      });
    }
    this.strip = { data, width, dz };

    // ── the landmarks, set where the camera will be ───────────────────────
    for (const m of this.pendingMarks) {
      // Set ahead of where the camera is as it is named — where the lens is
      // looking — so that the approach is towards it and not over it.
      // (The camera arrives at Jerusalem still slowing from the road: the
      // sanctuary is set by where it will be once it has slowed — far enough
      // short of it that, come up from the south, it has al-Masjid al-Aqsa
      // below it and the Dome of the Rock beyond.)
      const z = m.kind === "aqsa" ? this.zAt(m.at + (SIGNS.aqsa.ramp ?? 3)) + 215 : this.zAt(m.at) + 600;
      // The land ahead is the recitation still to come, which may already be
      // the road north. A landmark claims the country round it for its own:
      // Makkah's mountains and streets, Jerusalem's old town and olive hills.
      this.claimLand(z, SIGNS[m.kind].land ?? {}, m.kind === "aqsa" ? 2200 : 1500);
      const land = this.landAtZ(z);
      this.landmarks.push({ kind: m.kind, x: pathX(z, land.straight), y: Math.max(0, this.groundAt(z)), z });
    }
  }

  /** Make the strip, for some way either side of a place, the land given. */
  private claimLand(z: number, land: Partial<Record<LandKey, number>>, reach: number) {
    const { width, dz, data } = this.strip;
    const j0 = Math.max(0, Math.floor((z - reach) / dz));
    const j1 = Math.min(width - 1, Math.ceil((z + reach) / dz));
    for (let j = j0; j <= j1; j++) {
      const w = smooth((1 - Math.abs(j * dz - z) / reach) / 0.4);
      if (w <= 0) continue;
      LAND_KEYS.forEach((k, c) => {
        const target = land[k];
        if (target === undefined) return;
        const i = j * 4 + (c & 3);
        data[c >> 2][i] = lerp(data[c >> 2][i], target, w);
      });
    }
  }

  /** The landmark the camera is near enough to see, if any. */
  landmarkNear(z: number): PlacedLandmark | null {
    let best: PlacedLandmark | null = null;
    for (const m of this.landmarks) {
      const d = Math.abs(m.z - z);
      if (d < 6000 && (!best || d < Math.abs(best.z - z))) best = m;
    }
    return best;
  }

  // ── reading the score ───────────────────────────────────────────────────

  private score(score: Score) {
    score.ayat.forEach(([cues, veil, look], i) => {
      const t = this.timings[i];
      if (!t) return;
      const end = t.start + t.duration;
      const wordAt = (pos: number) => t.start + (t.words[Math.max(0, pos - 1)] ?? 0);

      if (veil) {
        // Closed before the word that names the unseen is reached, not after.
        const from = veil === 1 ? t.start - 1.2 : wordAt(veil) - 1.4;
        this.skyEvents.push({ t: from, until: end + 1.2, ramp: 1.3, release: 2.6, sky: SIGNS.veil.sky });
        this.veils.push([from, end + 1.2 + 2.6]);
      }
      if (look) this.skyEvents.push({ t: wordAt(look), until: end + 1.5, ramp: 2, release: 3, sky: SIGNS.look.sky });

      for (const [pos, raw] of cues) {
        const noHour = raw.endsWith("!");
        const id = noHour ? raw.slice(0, -1) : raw;
        if (!isSign(id)) continue;
        const def: SignDef = SIGNS[id];
        // A word is foreseen a moment before it is said: the sky starts to
        // turn as the reciter reaches it, and has turned as it ends.
        const at = wordAt(pos) - 0.35;
        const ramp = def.ramp ?? 3;
        if (id === "veil") {
          this.skyEvents.push({ t: at, until: at + 2.6, ramp: 1.4, release: 1.8, sky: def.sky });
          continue;
        }
        if (id === "bow") {
          this.skyEvents.push({ t: at + 0.3, until: end + 2.5, ramp: def.ramp ?? 2.5, release: 3, sky: def.sky });
          continue;
        }
        if (def.sky) {
          this.skyEvents.push({ t: at, until: end + (def.hold ?? 12), ramp, release: def.release ?? 8, sky: def.sky });
        }
        if (def.land) {
          this.landEvents.push({
            t: at,
            until: end + (def.hold ?? 12) + 6,
            ramp: def.landRamp ?? Math.max(ramp, 6),
            release: 14,
            land: def.land,
          });
        }
        if (def.landmark) {
          // Set ahead of the camera as it is named, where the lens is looking:
          // the camera comes towards it while the passage lasts.
          this.pendingMarks.push({ kind: def.landmark, at });
        }
        if (!noHour && (def.hour !== undefined || def.lapse !== undefined)) this.hourStep(at, def, ramp);
        else if (!noHour && !def.byNight && (def.land || DAYLIGHT.has(id))) {
          // A sign of the land, the water or what grows is a thing to be
          // seen by day: named in the night, it brings the morning on.
          const now = ((this.hourSettled(at) % 24) + 24) % 24;
          if (now > 19.6 || now < 5.4) this.hourStep(at, { hour: 8.3 }, Math.max(ramp, 5));
        }
        if (def.caption) this.captions.push({ t: wordAt(pos), ayah: i, position: pos, sign: id });
      }
    });
    this.skyEvents.sort((a, b) => a.t - b.t);
    this.landEvents.sort((a, b) => a.t - b.t);
  }

  /** The hour the film will have come to by `t`, once every step begun before it has finished. */
  private hourSettled(t: number): number {
    let h = this.hour0 + DRIFT * t;
    for (const s of this.hours) if (s.t0 <= t) h += s.delta;
    return h;
  }

  private hourStep(t: number, def: SignDef, ramp: number) {
    let delta: number;
    if (def.lapse !== undefined) delta = def.lapse;
    else {
      const now = ((this.hourSettled(t) % 24) + 24) % 24;
      delta = (((def.hour as number) - now) % 24 + 24) % 24;
      // A few hours behind is held, not gone round the clock for: the sun
      // named at ten in the morning, at noon, leaves the noon where it is.
      if (delta > 21) delta = 0;
    }
    if (delta < 0.05) return;
    const span = Math.max(ramp, delta / MAX_RATE);
    this.hours.push({ t0: t, t1: t + span, delta });
  }

  private layRegions(score: Score) {
    const at = (ayah: number) => this.timings[Math.min(this.timings.length - 1, Math.max(0, ayah - 1))];
    for (const [from, to, region] of score.passages) {
      const a = at(from);
      const b = at(to);
      if (!a || !b) continue;
      this.regions.push({ t0: a.start, t1: b.start + b.duration, land: REGION_LAND[region] ?? {} });
    }
    if (!this.regions.length) this.regions.push({ t0: 0, t1: this.duration, land: REGION_LAND.plains });
  }

  // ── the sky ─────────────────────────────────────────────────────────────

  hourAt(t: number): number {
    let h = this.hour0 + DRIFT * t;
    for (const s of this.hours) {
      if (t <= s.t0) continue;
      h += s.delta * smooth((t - s.t0) / (s.t1 - s.t0));
    }
    return h;
  }

  private skyAt(t: number): Record<SkyKey, number> {
    const out = { ...this.base };
    for (const e of this.skyEvents) {
      if (e.t > t) break;
      if (t > e.until + e.release) continue;
      const w = smooth((t - e.t) / e.ramp) * (t > e.until ? 1 - smooth((t - e.until) / e.release) : 1);
      if (w <= 0 || !e.sky) continue;
      for (const k in e.sky) {
        const key = k as SkyKey;
        out[key] = lerp(out[key], e.sky[key] as number, w);
      }
    }
    return out;
  }

  sky(t: number): SkyState {
    return { ...this.skyAt(t), hour: this.hourAt(t) };
  }

  // ── the land ────────────────────────────────────────────────────────────

  private landAt(t: number): Record<LandKey, number> {
    const out = Object.fromEntries(LAND_KEYS.map((k) => [k, 0])) as Record<LandKey, number>;
    // The passages' lands, cross-faded where one passage gives way to the next.
    let total = 0;
    const mix: Partial<Record<LandKey, number>> = {};
    for (const r of this.regions) {
      const w = smooth((t - r.t0 + 8) / 16) * (1 - smooth((t - r.t1 + 8) / 16));
      if (w <= 0) continue;
      total += w;
      for (const k in r.land) mix[k as LandKey] = (mix[k as LandKey] ?? 0) + (r.land[k as LandKey] as number) * w;
    }
    if (total > 0) for (const k in mix) out[k as LandKey] = (mix[k as LandKey] as number) / total;
    // A long passage is not one unchanging plain: the country rises and
    // falls through it, and an outcrop or a stand of palms comes and goes.
    const slow = Math.sin(t / 47) * 0.5 + Math.sin(t / 113 + 1.7) * 0.5;
    out.mount = Math.min(1, out.mount * (0.8 + 0.2 * slow) + Math.max(0, slow - 0.55) * 0.5);
    out.fields = Math.min(1, out.fields + Math.max(0, -slow - 0.6) * 0.6);

    for (const e of this.landEvents) {
      if (e.t > t) break;
      if (t > e.until + e.release) continue;
      const w = smooth((t - e.t) / e.ramp) * (t > e.until ? 1 - smooth((t - e.until) / e.release) : 1);
      if (w <= 0 || !e.land) continue;
      for (const k in e.land) {
        const key = k as LandKey;
        const target = e.land[key] as number;
        out[key] = lerp(out[key], target, w);
        // The sea and the mountains do not stand in the same place: a sign
        // for the one gives the other way.
        if (key === "sea" && target > 0.5) {
          out.mount = lerp(out.mount, out.mount * 0.15, w);
          out.dune = lerp(out.dune, 0, w);
          out.coast = lerp(out.coast, 0, w);
          out.palms = lerp(out.palms, 0, w);
        }
        if (key === "mount" && target > 0.5) out.sea = lerp(out.sea, 0, w);
      }
    }
    // Where the unseen is recited the land is laid out bare — no palms, no
    // orchard, no field, no stream — so that nothing glimpsed through the
    // veil, or as it lifts, could be taken for the Garden.
    let bare = 0;
    for (const [a, b] of this.veils) {
      if (t < a - 10 || t > b + 10) continue;
      bare = Math.max(bare, smooth((t - a + 10) / 10) * (1 - smooth((t - b) / 10)));
    }
    if (bare > 0) {
      out.palms *= 1 - bare;
      out.trees *= 1 - bare;
      out.fields *= 1 - bare;
      out.river *= 1 - bare;
      out.dune = Math.max(out.dune, 0.6 * bare * (1 - out.sea));
    }
    return out;
  }

  /** The land at a distance along the line — what the strip holds there. */
  landAtZ(z: number): Record<LandKey, number> {
    const { width, dz } = this.strip;
    const u = Math.max(0, Math.min(width - 1, z / dz));
    const j = Math.floor(u);
    const f = u - j;
    const k = Math.min(width - 1, j + 1);
    const out = {} as Record<LandKey, number>;
    LAND_KEYS.forEach((key, c) => {
      const row = this.landGrid[c >> 2];
      const ch = c & 3;
      out[key] = lerp(row[j * 4 + ch], row[k * 4 + ch], f);
    });
    return out;
  }

  // ── where the camera is ─────────────────────────────────────────────────

  zAt(t: number): number {
    const u = (t + 30) / GRID;
    const i = Math.max(0, Math.min(this.zGrid.length - 2, Math.floor(u)));
    const f = Math.max(0, Math.min(1, u - i));
    return lerp(this.zGrid[i], this.zGrid[i + 1], f);
  }

  private timeAtZ(z: number): number {
    const g = this.zGrid;
    let lo = 0;
    let hi = g.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (g[mid] <= z) lo = mid;
      else hi = mid;
    }
    const span = g[hi] - g[lo] || 1;
    return (lo + (z - g[lo]) / span) * GRID - 30;
  }

  groundAt(z: number): number {
    const l = this.landAtZ(z);
    return floorOf(l.sea, l.mount, l.dune, l.harrah, l.river) + undulation(z) * (1 - l.sea);
  }

  /**
   * The camera at a moment of film. `idle` is wall-clock seconds, which keep
   * a held camera breathing while the recitation is paused.
   */
  camera(t: number, sky: SkyState, idle = 0): CameraState {
    const z = this.zAt(t) + Math.sin(idle * 0.21) * 1.6;
    const here = this.landAtZ(z);
    const x = pathX(z, here.straight);
    // Clear of the ground a little way ahead as well as under it.
    let ground = -Infinity;
    for (const ahead of [0, 40, 90, 160]) ground = Math.max(ground, Math.max(0, this.groundAt(z + ahead)));
    let y = ground + altitude(sky.alt) + Math.sin(idle * 0.5) * 0.35;
    // Up out of the air: the climb is steady in the logarithm of the height,
    // so it gathers pace as it goes, as a rising thing seems to.
    if (sky.space > 0.001) y = Math.exp(lerp(Math.log(Math.max(2, y)), Math.log(SPACE_HEIGHT), smooth(sky.space)));
    // Beneath the sea, in the darknesses of 24:40.
    // Beneath the sea: a few metres down for the pearls, deep for the darknesses
    // of 24:40 — and through the surface quickly, never lingering in it.
    if (sky.under > 0.001 && here.sea > 0.6) y = lerp(y, -2.5 - 26 * sky.under * sky.under, smooth((sky.under - 0.12) / 0.3));
    const ahead = pathX(z + 25, this.landAtZ(z + 25).straight);
    const behind = pathX(z - 25, this.landAtZ(z - 25).straight);
    const yaw =
      Math.atan2(ahead - behind, 50) +
      sky.sweep * 0.55 * Math.sin(t * 0.075) +
      Math.sin(idle * 0.13) * 0.015;
    const bend = ahead - 2 * x + behind;
    const pitch = -0.085 + sky.gaze * 0.78 - sky.bow * 0.62 - sky.alt * 0.2 + Math.sin(idle * 0.37) * 0.006;
    const roll = Math.max(-0.12, Math.min(0.12, -bend * 0.004)) * (1 - sky.look);
    return { x, y, z, yaw, pitch, roll, height: y - Math.max(0, this.groundAt(z)) };
  }

  // ── the recitation's clock, as film time ────────────────────────────────

  indexOf(key: string): number {
    return this.timings.findIndex((t) => t.key === key);
  }

  /**
   * Film time for a place in the recitation. The recording's true length,
   * once known, stretches the ayah's laid-out time to fit it, so the camera
   * neither waits at the end of an ayah nor jumps at the start of the next.
   */
  timeOf(key: string, seconds: number, recorded?: number): number {
    const i = this.indexOf(key);
    if (i < 0) return 0;
    const t = this.timings[i];
    const scale = recorded && Number.isFinite(recorded) && recorded > 0.5 ? t.duration / recorded : 1;
    return t.start + Math.max(0, Math.min(t.duration, seconds * scale));
  }

  /** Which ayah, and which of its words, film time is in. */
  placeAt(t: number): { index: number; position: number } {
    const ts = this.timings;
    let lo = 0;
    let hi = ts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ts[mid].start <= t) lo = mid;
      else hi = mid - 1;
    }
    const a = ts[lo];
    if (!a) return { index: 0, position: 0 };
    const into = t - a.start;
    let position = 0;
    for (let w = 0; w < a.words.length; w++) if (a.words[w] <= into) position = w + 1;
    return { index: lo, position };
  }

  // ── the surah in colour, for the ribbon ─────────────────────────────────

  /** The colour each ayah's stretch of film is mostly, as `rgb()`. */
  ribbon(): string[] {
    return this.timings.map((a) => {
      const t = a.start + a.duration * 0.5;
      const s = this.sky(t);
      const land = this.landAtZ(this.zAt(t));
      return css(tint(s, land));
    });
  }
}

// ── colour ───────────────────────────────────────────────────────────────

type RGB = [number, number, number];
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = ([r, g, b]: RGB) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;

/** The light of an hour, as it is mostly seen. */
export function hourColour(hour: number): RGB {
  const h = ((hour % 24) + 24) % 24;
  const stops: [number, RGB][] = [
    [0, [18, 24, 52]],
    [4.4, [30, 36, 78]],
    [5.6, [196, 112, 88]],
    [6.4, [236, 170, 104]],
    [8, [150, 186, 214]],
    [12, [112, 168, 222]],
    [16, [150, 180, 206]],
    [17.6, [232, 160, 86]],
    [18.4, [196, 92, 70]],
    [19.2, [62, 52, 98]],
    [21, [22, 28, 60]],
    [24, [18, 24, 52]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (h <= stops[i][0]) {
      const [h0, c0] = stops[i - 1];
      const [h1, c1] = stops[i];
      return mixRGB(c0, c1, (h - h0) / (h1 - h0));
    }
  }
  return stops[0][1];
}

function tint(s: SkyState, land: Record<LandKey, number>): RGB {
  let c = hourColour(s.hour);
  c = mixRGB(c, [120, 124, 132], Math.min(0.75, s.cloud * 0.6 + s.rain * 0.4));
  c = mixRGB(c, [36, 96, 140], land.sea * 0.35);
  c = mixRGB(c, [70, 118, 52], Math.min(0.4, land.fields * s.revive * 0.35 + land.palms * 0.15));
  c = mixRGB(c, [70, 48, 18], s.veil * 0.82);
  c = mixRGB(c, [214, 160, 72], s.lamp * 0.5);
  return c;
}

/** The moon's phase on a date: 0 new, 0.5 full. */
export function moonPhase(date = new Date()): number {
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - ref) / 86400000;
  const p = (days / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}
