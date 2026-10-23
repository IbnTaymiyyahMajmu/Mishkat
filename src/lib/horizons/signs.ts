/**
 * The signs: what a word of the Qur'an does to the world it is recited over.
 *
 * The Qur'an calls its verses āyāt and calls the sun, the rain and the
 * mountains āyāt as well — the same word, signs. This is the vocabulary that
 * joins the two. When the reciter reaches وَٱلشَّمْسِ the sun comes into the
 * frame; at وَٱلْجِبَالَ the land rises into mountains ahead; at مِنَ ٱلسَّمَآءِ
 * مَآءً the cloud thickens and it rains. Which word is which sign is decided
 * once, for every ayah, by `scripts/build-horizons.mjs` from the corpus's
 * morphology and the hand-written direction beside it; this file only says
 * what each sign looks like.
 *
 * ── what is never shown ──────────────────────────────────────────────────
 *
 * Only what can be seen in creation is drawn: sky and its lights, weather,
 * water, land and what grows from it. Nothing with a soul — no person, no
 * animal, no bird. Nothing of the unseen — not the Throne, the angels, the
 * jinn, the Day, the Garden or the Fire: an ayah that speaks of them is
 * `veil`ed, and the world withdraws behind the light of the lamp while it is
 * recited. Nothing is re-enacted: a story's sea or wind may be shown as sea
 * or wind, never its people or its miracle. And nothing is heard but the
 * recitation.
 *
 * ── two kinds of change ──────────────────────────────────────────────────
 *
 * A sign changes the *sky* — the hour, the weather, where the camera looks —
 * and that change happens where the camera is, over a few seconds, as weather
 * does. Or it changes the *land*, and the land is not remade under the camera:
 * it is laid out ahead of it, so that the coast is seen coming before the word
 * that names the sea, and the camera is out over the water as it is said. The
 * director (`director.ts`) does that laying out.
 */

export type SkyKey =
  | "cloud"
  | "rain"
  | "storm"
  | "hail"
  | "wind"
  | "stars"
  | "moon"
  | "phase"
  | "sun"
  | "haze"
  | "revive"
  | "dry"
  | "mirage"
  | "fire"
  | "meteor"
  | "alt"
  | "gaze"
  | "speed"
  | "under"
  | "lamp"
  | "veil"
  | "look"
  | "bow"
  | "sweep"
  /** The world darkened for a while, and let light again: darknesses that pass. */
  | "dim"
  /** Up out of the air altogether: the earth's curve below, the stars above. */
  | "space";

export type LandKey =
  | "sea"
  | "mount"
  | "dune"
  /** A shore along the camera's line: the sea on its left, the land on its right. */
  | "coast"
  | "fields"
  | "trees"
  | "palms"
  | "river"
  | "harrah"
  | "seam"
  | "strata"
  | "straight"
  /** A city's streets and roofs, and its lights at night. */
  | "city"
  /** How much of that city is an old town: smaller houses, wandering lanes, domes on the roofs. */
  | "old";

export interface SignDef {
  /** Where the sky's values head while the sign holds. */
  sky?: Partial<Record<SkyKey, number>>;
  /** An hour of the day to come to — always forward: the film's day never runs back. */
  hour?: number;
  /** Or a stretch of hours to pass through, as in a time-lapse. */
  lapse?: number;
  /** What the land ahead is made of while the sign holds. */
  land?: Partial<Record<LandKey, number>>;
  /** Seconds to arrive. */
  ramp?: number;
  /** Seconds it stays after its ayah has ended. */
  hold?: number;
  /** Seconds it takes to let go again (eight, unless said). */
  release?: number;
  /** Seconds the land takes to become what it names, where six would be too slow. */
  landRamp?: number;
  /** Seen by night, and meant to be: it does not bring the morning on, as a sign of the land otherwise does. */
  byNight?: boolean;
  /** The word is set in the frame beside what it named. */
  caption?: boolean;
  /** A sign that names only a slight change, which a stronger sign in the same ayah overrules. */
  weak?: boolean;
  /**
   * A place drawn as it stands: the director sets it on the land where the
   * camera will be when the next sign in the ayah comes (or a few seconds on).
   */
  landmark?: Landmark;
}

/**
 * The places drawn as they stand today — buildings, which have no soul, at
 * the owner's ruling that a story's landmarks may be shown (C).
 *
 *   haram   al-Masjid al-Ḥarām at night, from above: the white of the
 *           courtyard round the Kaʿbah, lit, in a valley of dark mountains.
 *   aqsa    the Noble Sanctuary in Jerusalem: its platform, the Dome of the
 *           Rock in gold, and al-Masjid al-Aqṣā at the south end.
 */
export type Landmark = "haram" | "aqsa";

/**
 * Every sign the score can name. The generator refuses a direction line or a
 * lexicon entry that names one not here.
 */
export const SIGNS = {
  // ── the sky and its lights ────────────────────────────────────────────────
  sun: { hour: 10, sky: { sun: 1, gaze: 0.18, cloud: 0.1 }, caption: true },
  sunlight: { hour: 10.5, sky: { sun: 0.8, haze: 0.25 }, caption: true },
  /** The sun as a lamp: سِرَاجًا وَهَّاجًا. */
  lampSun: { hour: 11, sky: { sun: 1, haze: 0.3, gaze: 0.15 }, caption: true },
  moon: { hour: 21.5, sky: { moon: 1, phase: 0.5, gaze: 0.2, cloud: 0.05 }, caption: true },
  /** The moon as it follows the sun (91:2): risen full in the east as the sun goes down in the west. */
  moonrise: { hour: 18.35, sky: { moon: 1, phase: 0.5, sun: 0.7, gaze: 0.05, cloud: 0 }, caption: true },
  /** The new moon, and the old date-stalk it wanes back into (36:39). */
  crescent: { hour: 19.1, sky: { moon: 1, phase: 0.09, gaze: 0.12, cloud: 0 }, caption: true },
  fullMoon: { hour: 22, sky: { moon: 1, phase: 0.5, gaze: 0.18 }, caption: true },
  /** The moon through its phases, as 10:5 and 36:39 describe it measured out. */
  phases: { hour: 20, sky: { moon: 1, phase: 0.5, gaze: 0.16 }, ramp: 9, caption: true },
  stars: { hour: 23, sky: { stars: 1, gaze: 0.42, cloud: 0, haze: 0.05 }, caption: true },
  /** The nearest heaven adorned with lamps (41:12, 67:5). */
  lamps: { hour: 23.5, sky: { stars: 1, gaze: 0.5, cloud: 0, lamp: 0.25 }, caption: true },
  /** A bright star by name: الشِّعْرَى (53:49). */
  sirius: { hour: 23, sky: { stars: 1, gaze: 0.3, cloud: 0 }, caption: true },
  meteor: { hour: 23.5, sky: { stars: 0.8, meteor: 1, gaze: 0.4, cloud: 0 }, caption: true },
  /** The planets that recede and hide (81:15–16). */
  planets: { hour: 4.6, sky: { stars: 0.9, gaze: 0.3, cloud: 0 }, caption: true },
  /** Each swimming in an orbit (21:33, 36:40): the camera climbs to see it. */
  orbit: { sky: { alt: 0.72, gaze: 0.35, stars: 0.7, speed: 0.7 }, ramp: 6, caption: true },
  sky: { sky: { gaze: 0.22 }, weak: true, caption: true },
  /** The sky raised, built, given a ceiling: the camera rises and looks up. */
  skyRaised: { sky: { gaze: 0.6, alt: 0.38, speed: 0.6 }, ramp: 5, caption: true },
  /** "The heavens and the earth": a wide view, risen a little. */
  heavens: { sky: { alt: 0.32, gaze: 0.12 }, ramp: 5, weak: true },
  /** "Lord of the worlds", "the east and the west": the horizon swept. */
  horizons: { sky: { alt: 0.3, sweep: 1, haze: 0.15 }, ramp: 5, caption: true },
  /** "Lord of the worlds": the view opened a little, and turned along the horizon. */
  worlds: { sky: { alt: 0.24, sweep: 0.55 }, ramp: 5, weak: true },
  light: { sky: { lamp: 0.35, sun: 0.6, haze: 0.2 }, ramp: 3, caption: true },
  /** The parable of the light (24:35): the niche, the lamp, the glass. */
  niche: { sky: { lamp: 1, veil: 0.55, speed: 0.4 }, ramp: 4, hold: 6, caption: true },
  /**
   * Darknesses. Most often the Qur'an's darknesses are a likeness — out of the
   * darknesses into the light — so they darken the world for a while rather
   * than bring on the night, and lift again.
   */
  darkness: { sky: { dim: 0.85, haze: 0.4, cloud: 0.55 }, hold: 4, caption: true },

  // ── the hours ─────────────────────────────────────────────────────────────
  dawn: { hour: 5.75, sky: { haze: 0.45, gaze: 0.08, cloud: 0.12 }, caption: true },
  predawn: { hour: 4.6, sky: { stars: 0.7, haze: 0.3 }, caption: true },
  morning: { hour: 7.4, sky: { haze: 0.35 }, caption: true },
  forenoon: { hour: 9.6, sky: { sun: 0.75, haze: 0.2 }, caption: true },
  noon: { hour: 12.5, sky: { sun: 0.6 }, caption: true },
  afternoon: { hour: 15.8, sky: { haze: 0.25 }, caption: true },
  evening: { hour: 17.2, sky: { haze: 0.35, sun: 0.5 }, caption: true },
  sunset: { hour: 18.15, sky: { sun: 0.9, haze: 0.4, gaze: 0.05 }, caption: true },
  twilight: { hour: 18.75, sky: { haze: 0.35, gaze: 0.08 }, caption: true },
  night: { hour: 22, sky: { stars: 0.65, cloud: 0.08 }, caption: true },
  /** The night as it departs (81:17, 74:33). */
  nightDeparts: { hour: 4.9, sky: { stars: 0.5, haze: 0.3 }, caption: true },
  day: { hour: 11, sky: { haze: 0.15 }, caption: true },
  /**
   * The night and the day following one another, the one wrapped over the
   * other, the night drawn out of the day: a whole day passes in the ayah.
   */
  nightDay: { lapse: 24, ramp: 11, sky: { alt: 0.24, cloud: 0.12 }, caption: true },
  /** "Morning and evening" in one breath: the day crossed from one to the other. */
  morningEvening: { lapse: 10, ramp: 8, caption: true },
  /** The shade drawn out and drawn in again (25:45): the sun crosses and the shadows swing. */
  shade: { lapse: 7, ramp: 10, sky: { sun: 0.4, alt: 0.08, gaze: -0.08 }, caption: true },

  // ── weather ───────────────────────────────────────────────────────────────
  cloud: { sky: { cloud: 0.78, haze: 0.25 }, caption: true },
  rain: { sky: { cloud: 0.92, rain: 0.85, wind: 0.35, haze: 0.4 }, ramp: 3.5, hold: 16, caption: true },
  drizzle: { sky: { cloud: 0.7, rain: 0.28, haze: 0.45 }, caption: true },
  /** The rainstorm of 2:19: darkness, thunder and lightning. */
  storm: { sky: { cloud: 1, rain: 0.9, storm: 1, wind: 0.6, haze: 0.4 }, caption: true },
  lightning: { sky: { cloud: 0.95, storm: 1, rain: 0.35 }, caption: true },
  thunder: { sky: { cloud: 1, storm: 0.85, rain: 0.4 }, caption: true },
  hail: { sky: { cloud: 1, rain: 0.6, hail: 1, storm: 0.5 }, caption: true },
  wind: { sky: { wind: 0.85, cloud: 0.35, speed: 1.35, haze: 0.3 }, caption: true },
  gale: { sky: { wind: 1, cloud: 0.5, speed: 1.6, haze: 0.5 }, caption: true },
  /** The sky withholding and the water going down (11:44). */
  clearing: { sky: { cloud: 0.08, rain: 0, storm: 0, wind: 0.15, haze: 0.12, sun: 0.6 }, ramp: 6, caption: true },
  /** The wind stilled, and the ships held motionless on the face of the sea (42:33, 44:24). */
  calm: { sky: { wind: 0, cloud: 0.1, speed: 0.45, haze: 0.3 }, ramp: 5, caption: true },
  mirage: { hour: 13.5, sky: { mirage: 1, haze: 0.5, cloud: 0 }, land: { dune: 0.6 }, caption: true },
  /** The fire kindled, and the green tree it comes from (36:80, 56:71). */
  fire: { hour: 21, sky: { fire: 1, stars: 0.4 }, caption: true },

  // ── water ─────────────────────────────────────────────────────────────────
  sea: { land: { sea: 1 }, sky: { wind: 0.3 }, caption: true },
  waves: { land: { sea: 1 }, sky: { wind: 0.95, cloud: 0.7, haze: 0.4 }, caption: true },
  /** Two seas meeting, a barrier between them they do not transgress. */
  twoSeas: { land: { sea: 1, seam: 1 }, sky: { alt: 0.28, gaze: -0.12 }, ramp: 5, hold: 18, caption: true },
  /** Darknesses in a deep sea, wave over wave, cloud over that (24:40). */
  deep: { land: { sea: 1 }, sky: { under: 1, cloud: 0.9, speed: 0.5, gaze: 0.34, dim: 0 }, ramp: 6, hold: 4, caption: true },
  /** Pearls and coral, from both seas: below the surface, where the light comes down. */
  pearls: { land: { sea: 1, seam: 0.6 }, sky: { under: 0.62, gaze: 0.22 }, ramp: 5, hold: 3, caption: true },
  river: { land: { river: 1, fields: 0.5 }, caption: true },
  spring: { land: { river: 0.8, mount: 0.4, fields: 0.3 }, caption: true },
  /** The torrent in the valleys, and the foam it carries (13:17). */
  torrent: { land: { river: 1, mount: 0.6 }, sky: { rain: 0.6, cloud: 0.85 }, caption: true },
  valley: { land: { mount: 0.65, river: 0.25 }, caption: true },

  // ── land ──────────────────────────────────────────────────────────────────
  mountains: { land: { mount: 1 }, caption: true },
  /** Tracks white and red in the mountains, of every hue, and jet black (35:27). */
  strata: { land: { mount: 1, strata: 1 }, sky: { alt: 0.2 }, hold: 18, caption: true },
  rock: { land: { mount: 0.55, harrah: 0.3 }, caption: true },
  dunes: { land: { dune: 1 }, caption: true },
  hill: { land: { fields: 0.6 }, sky: { alt: 0.15 }, caption: true },
  /** The earth spread out, made a bed, a carpet: the camera rises to see how far. */
  earthSpread: { land: { fields: 0.3 }, sky: { alt: 0.42, gaze: -0.18, speed: 0.75 }, ramp: 5, caption: true },
  /** The earth given life after its death: it quivers, it swells, it greens. */
  revive: { sky: { revive: 1, rain: 0.25, cloud: 0.45 }, land: { fields: 0.9 }, ramp: 8, hold: 22, caption: true },
  /** The straight path: the camera's weaving line runs straight for the horizon. */
  straight: { land: { straight: 1 }, sky: { gaze: 0.04 }, hold: 6 },
  /** "Travel through the land": low and quick over it. */
  journey: { sky: { speed: 1.7, alt: 0.05 }, ramp: 3 },

  // ── what grows ────────────────────────────────────────────────────────────
  plants: { land: { fields: 1 }, sky: { revive: 0.85 }, caption: true },
  crops: { land: { fields: 1 }, sky: { revive: 0.7, dry: 0.2 }, caption: true },
  /** The grain of 2:261, seven ears and a hundred grains in each. */
  grain: { land: { fields: 1 }, sky: { revive: 0.6, dry: 0.45, alt: 0.04, gaze: -0.1 }, caption: true },
  /** The young shoot that strengthens and stands on its stem (48:29). */
  sprout: { land: { fields: 1 }, sky: { revive: 1, alt: 0.03, gaze: -0.15 }, ramp: 7, caption: true },
  harvest: { land: { fields: 1 }, sky: { dry: 0.7, revive: 0.6 }, caption: true },
  green: { land: { fields: 0.9 }, sky: { revive: 1 }, caption: true },
  pasture: { land: { fields: 0.9 }, sky: { revive: 0.8 }, caption: true },
  /** Withered, yellowed, broken into chaff. */
  dry: { sky: { dry: 1, revive: 0.5 }, caption: true },
  /**
   * The whole of a plant's life in one ayah: rain, the green, the yellow,
   * the chaff — the parable of this world's life (39:21, 57:20, 10:24, 18:45).
   */
  lifecycle: { land: { fields: 1 }, sky: { revive: 1, rain: 0.4, cloud: 0.6 }, ramp: 4, hold: 6, caption: true },
  trees: { land: { trees: 1, fields: 0.4 }, sky: { revive: 0.7 }, caption: true },
  palms: { land: { palms: 1, fields: 0.5 }, sky: { revive: 0.6 }, caption: true },
  olives: { land: { trees: 1, fields: 0.3 }, sky: { revive: 0.5 }, caption: true },
  vines: { land: { fields: 0.8, trees: 0.4 }, sky: { revive: 0.8 }, caption: true },
  fruit: { land: { trees: 0.9, palms: 0.3, fields: 0.5 }, sky: { revive: 0.85 }, caption: true },
  garden: { land: { trees: 0.9, palms: 0.6, fields: 1, river: 0.45 }, sky: { revive: 1 }, caption: true },

  // ── the heavens and the earth, from above them ────────────────────────────
  /**
   * Āyat al-Kursī (2:255), at the owner's ruling (B1): nothing is shown for
   * the Kursī; Allah's creation is. At "the heavens" the camera is high over
   * a great range of mountains in the last of the night, the morning star
   * and the stars still out, mist in the valleys; it glides on over ridge
   * after ridge as the sky pales, and part way through the ayah the sun
   * comes up over the peaks ahead. At "extends" it rises out of the air
   * (space), the sun just over the earth's rim.
   */
  majesty: { hour: 5.9, land: { mount: 1, trees: 0.2, harrah: 0, dune: 0, fields: 0, palms: 0, sea: 0, city: 0 }, sky: { alt: 0.62, gaze: 0.12, speed: 0.4, cloud: 0.3, haze: 0.06, stars: 1, sun: 0.8 }, ramp: 9, landRamp: 6, hold: 3, release: 14 },
  /** Out past the air: the earth's curve below, the thin blue rim of it, and the stars. */
  space: { sky: { space: 1, gaze: -0.4, speed: 0.08, stars: 1, cloud: 0.25 }, ramp: 4, hold: 3, release: 18, byNight: true },
  /** Straight up from where the camera is, looking down — and a little back — on the city as it falls away beneath. */
  ascent: { sky: { space: 1, gaze: -2.05, speed: 0, stars: 1, cloud: 0 }, ramp: 4.5, hold: 0, release: 18, byNight: true },

  // ── the Night Journey (17:1), at the owner's ruling (B2) ──────────────────
  // The journey as land and sky alone: never the Prophet ﷺ, never any figure,
  // never al-Burāq. Top-down over al-Masjid al-Ḥarām by night, north over the
  // desert, to Jerusalem and the Dome, then up into space.
  /** Over Makkah by night, looking down on the lit valley among its mountains. */
  haram: { hour: 23, land: { mount: 0.95, city: 1, old: 0, dune: 0, fields: 0, palms: 0, trees: 0, sea: 0 }, landmark: "haram", sky: { alt: 0.62, gaze: -1.1, speed: 0.5, cloud: 0, stars: 0.7 }, ramp: 3, landRamp: 2, hold: 0, byNight: true },
  /** The road north by night: the desert streaming past below. */
  nightRoad: { land: { harrah: 0.6, dune: 0.75, mount: 0.12, city: 0, fields: 0, palms: 0, trees: 0 }, sky: { alt: 0.6, gaze: -1.8, speed: 7, cloud: 0, phase: 0.5, moon: 0.3 }, ramp: 2.5, landRamp: 2, hold: 0, byNight: true },
  /** Jerusalem: come down from the south over al-Masjid al-Aqsa, low, towards the golden Dome; the old city's lit lanes about it, the olive groves beyond. */
  aqsa: { land: { city: 1, old: 1, trees: 0.7, mount: 0.3, harrah: 0, dune: 0, palms: 0 }, landmark: "aqsa", sky: { alt: 0.27, gaze: -0.31, speed: 0.45, cloud: 0 }, ramp: 3.5, landRamp: 2.5, hold: 0, byNight: true },

  // ── the camera's own grammar ──────────────────────────────────────────────
  /** "Have you not seen…?", "Look…": the camera slows, steadies, and looks. */
  look: { sky: { look: 1, speed: 0.45 }, ramp: 2 },
  /** An ayah of prostration: the camera bows to the earth. */
  bow: { sky: { bow: 1, speed: 0.3 }, ramp: 2.5, hold: 3 },
  /** The unseen: the world withdraws behind the light of the lamp. */
  veil: { sky: { veil: 1, speed: 0.55 }, ramp: 2.2, hold: 1.5 },
} satisfies Record<string, SignDef>;

export type SignId = keyof typeof SIGNS;

export function isSign(id: string): id is SignId {
  return id in SIGNS;
}

export function signOf(id: SignId): SignDef {
  return SIGNS[id];
}
