// npm run gen:footage
//
// The filmed footage Horizons shows in place of its drawn film: each clip the
// owner has approved, cut from its source to the seconds that are used, given
// one light so that clips from a dozen cameras read as one journey, stripped of
// its sound, and encoded for the web at the sizes a phone and a desktop want.
//
// What is used, from where, and on what licence is written by hand in
// src/content/horizons/footage.json, one entry to a clip. A clip is fetched
// only when its entry says `"approved": true`: footage is downloaded on the
// owner's word and not before, and this script will not do otherwise even when
// asked for that clip by name. Only the seconds between `in` and `out` are read
// from the source, so ten seconds of a 30-minute NASA film costs ten seconds of
// download, not nine gigabytes.
//
// Writes each clip's encodings, a poster frame and a blurred one to the
// footage folder (by default node_modules/.cache/mishkat/horizons-footage/dist,
// which is not committed: it is what goes to wherever the footage is served
// from), and public/horizons/footage.json, the index the film reads: every
// clip's files with their sizes and codecs, its length, the signs it can stand
// for, and the credit its licence asks for.
//
//   node scripts/build-horizons-footage.mjs               every approved clip
//   node scripts/build-horizons-footage.mjs --plan        say what would be fetched, and how much, and fetch nothing
//   node scripts/build-horizons-footage.mjs --only <id>   one clip
//   node scripts/build-horizons-footage.mjs --out <dir>   write the encodings somewhere else
//   node scripts/build-horizons-footage.mjs --manifest <file> --index <file>   other files in and out (for testing)
//
// Needs ffmpeg and ffprobe on the PATH, built with libx264 and libsvtav1.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fromRoot = (p) => (isAbsolute(p) ? p : resolve(ROOT, p));

const MANIFEST = fromRoot(option("--manifest") ?? "src/content/horizons/footage.json");
const INDEX = fromRoot(option("--index") ?? "public/horizons/footage.json");
const CACHE = fromRoot("node_modules/.cache/mishkat/horizons-footage/");
const DIST = fromRoot(option("--out") ?? join(CACHE, "dist"));
const ONLY = option("--only");
const PLAN = flag("--plan");

/** Bumped when an encoding setting changes, so that nothing made the old way is kept. */
const RECIPE = 2;

/**
 * The sizes each clip is encoded at. H.264 is played everywhere; AV1 is half
 * the size for the same picture and is offered first to a browser that can
 * decode it without spending a phone's battery (the film asks with
 * MediaCapabilities before choosing). A rendition taller than the source is not
 * made: a clip is never enlarged.
 */
const RENDITIONS = [
  { name: "1080", height: 1080, codec: "h264", crf: 22, maxrate: "6M" },
  { name: "720", height: 720, codec: "h264", crf: 23, maxrate: "3M" },
  { name: "480", height: 480, codec: "h264", crf: 24, maxrate: "1400k" },
  { name: "1080.av1", height: 1080, codec: "av1", crf: 35 },
  { name: "720.av1", height: 720, codec: "av1", crf: 37 },
];

/**
 * One light for every clip: the grade is chosen by the time of day the clip
 * stands for, not by what its camera happened to do. Kept gentle — a grade that
 * draws attention to itself is the opposite of the point.
 */
const GRADES = {
  none: [],
  day: ["eq=contrast=1.03:saturation=1.02", "colorbalance=rh=0.02:bh=-0.02"],
  dawn: ["eq=contrast=1.04:saturation=1.05:gamma=0.98", "colorbalance=rs=0.03:rm=0.03:bs=-0.03"],
  night: ["eq=contrast=1.06:saturation=0.92:gamma=0.94", "colorbalance=bs=0.04:rh=0.03:gh=0.01"],
  space: ["eq=contrast=1.05"],
};

/** Every clip sits in the niche: its corners fall away a little, as the film's own do. */
const FINISH = ["vignette=angle=0.32"];

/** Frames to a second in every encoding, and a keyframe on every second so the film can start a clip anywhere. */
const FPS = 30;

// ── the manifest ─────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   id: string, approved?: boolean, signs: string[], passages?: string[],
 *   source: { url: string, page: string, title: string, author?: string,
 *             licence: string, licenceUrl?: string, credit?: string,
 *             size?: number, duration?: number },
 *   in: number, out: number,
 *   crop?: { x: number, y: number, w: number, h: number },
 *   speed?: number, grade?: keyof typeof GRADES, loop?: number,
 *   motion?: string, mirror?: boolean, note?: string,
 * }} Clip
 */

function check(/** @type {Clip} */ c, i) {
  const where = `footage.json, clip ${i + 1}${c?.id ? ` (${c.id})` : ""}`;
  const fail = (why) => {
    throw new Error(`${where}: ${why}`);
  };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id ?? "")) fail("id must be lower-case words joined by hyphens");
  if (!Array.isArray(c.signs) || !c.signs.length) fail("names no sign it can stand for");
  if (!c.source?.url || !c.source?.page || !c.source?.title) fail("source needs url, page and title");
  if (!c.source.licence) fail("source has no licence: a clip without one is not used");
  if (!(Number.isFinite(c.in) && Number.isFinite(c.out) && c.out > c.in)) fail("in and out must be seconds, out after in");
  if (c.grade && !(c.grade in GRADES)) fail(`no grade called "${c.grade}"`);
  if (c.loop !== undefined && !(c.loop > 0 && c.loop * 2 < c.out - c.in)) fail("loop must be a crossfade shorter than half the clip");
  if (c.speed !== undefined && !(c.speed > 0.2 && c.speed <= 4)) fail("speed must be between 0.2 and 4");
  if (c.crop) for (const k of ["x", "y", "w", "h"]) if (!(c.crop[k] >= 0 && c.crop[k] <= 1)) fail("crop is in fractions of the frame, 0 to 1");
}

// ── ffmpeg ───────────────────────────────────────────────────────────────────

function run(cmd, argv, { quiet = false } = {}) {
  return new Promise((done, fail) => {
    // SVT_LOG=1: the AV1 encoder says only what has gone wrong.
    const p = spawn(cmd, argv, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, SVT_LOG: "1" } });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => {
      err += d;
      if (!quiet) process.stderr.write(d);
    });
    p.on("error", fail);
    p.on("close", (code) => (code === 0 ? done(out) : fail(new Error(`${cmd} exited ${code}\n${err.slice(-2000)}`))));
  });
}

async function probe(file) {
  const j = JSON.parse(
    await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { quiet: true }),
  );
  const v = j.streams.find((s) => s.codec_type === "video");
  return {
    duration: Number(j.format.duration),
    size: Number(j.format.size) || undefined,
    width: v?.width,
    height: v?.height,
    codec: v?.codec_name,
    profile: v?.profile,
    level: v?.level,
  };
}

const hash = (...parts) => createHash("sha1").update(JSON.stringify(parts)).digest("hex").slice(0, 12);
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

/**
 * The working copy of a clip: the seconds that are used, cropped, at the speed
 * it is shown at, no larger than 1080 lines, kept near-losslessly so that every
 * size and every regrade is made from it without fetching the source again.
 */
async function mezzanine(/** @type {Clip} */ c, src) {
  const key = hash(RECIPE, c.source.url, c.in, c.out, c.crop ?? null, c.speed ?? 1);
  const file = join(CACHE, "mezz", `${c.id}.${key}.mkv`);
  if (existsSync(file)) return { file, key };
  await mkdir(join(CACHE, "mezz"), { recursive: true });
  const vf = [];
  if (c.crop) {
    const { x, y, w, h } = c.crop;
    vf.push(`crop=${w}*iw:${h}*ih:${x}*iw:${y}*ih`);
  }
  if (c.speed && c.speed !== 1) vf.push(`setpts=PTS/${c.speed}`);
  vf.push(`scale=-2:'min(1080,ih)':flags=lanczos`, `fps=${FPS}`, "format=yuv420p");
  const tmp = `${file}.part.mkv`;
  // -ss and -to before -i: ffmpeg seeks in the source and reads only from there
  // to there, with HTTP range requests when the source is a URL.
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-stats", "-y",
    "-ss", String(c.in), "-to", String(c.out), "-i", src,
    "-an", "-sn", "-dn", "-map", "0:v:0",
    "-vf", vf.join(","),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "12",
    tmp,
  ]);
  await rename(tmp, file);
  return { file, key };
}

/**
 * A clip that is laid under a long veil is played round and round. Its last
 * seconds are crossfaded into its first, so the frame it ends on is the frame
 * it begins with and the turn cannot be seen.
 */
function loopGraph(seconds, fade) {
  // The fade is finished two frames early, so the clip ends on frames that are
  // wholly its opening's: a fade still at 98% on the last frame leaves a ghost
  // of the other picture there, and the turn flickers.
  const blend = fade - 2 / FPS;
  return [
    `[0:v]split[m][h]`,
    `[h]trim=0:${fade},setpts=PTS-STARTPTS[head]`,
    `[m]trim=${fade},setpts=PTS-STARTPTS[main]`,
    `[main][head]xfade=transition=fade:duration=${blend.toFixed(4)}:offset=${(seconds - fade - blend).toFixed(4)}[v]`,
  ].join(";");
}

/**
 * The sizes a source is made at: every rendition no taller than the source,
 * and, for a source smaller than all of them, the smallest rendition of each
 * codec at the source's own height.
 */
function renditionsFor(sourceHeight) {
  const made = [];
  for (const codec of new Set(RENDITIONS.map((r) => r.codec))) {
    const of = RENDITIONS.filter((r) => r.codec === codec);
    const fit = of.filter((r) => r.height <= sourceHeight);
    if (fit.length) made.push(...fit.map((r) => ({ r, height: r.height })));
    else made.push({ r: of[of.length - 1], height: sourceHeight });
  }
  return made;
}

async function encode(/** @type {Clip} */ c, mezz, info, r, height) {
  const key = hash(RECIPE, mezz.key, c.grade ?? "none", c.loop ?? 0, r, height);
  const name = `${c.id}.${r.name}.mp4`;
  const file = join(DIST, name);
  const stamp = join(CACHE, "stamps", `${name}.json`);
  if (existsSync(file) && existsSync(stamp) && JSON.parse(await readFile(stamp, "utf8")).key === key) {
    return { r, file, name, height };
  }
  const look = [...GRADES[c.grade ?? "none"], ...FINISH, `scale=-2:${even(height)}:flags=lanczos`, "format=yuv420p"].join(",");
  const graph = c.loop ? `${loopGraph(info.duration, c.loop)};[v]${look}[out]` : `[0:v]${look}[out]`;
  const codec =
    r.codec === "h264"
      ? ["-c:v", "libx264", "-preset", "slow", "-crf", String(r.crf), "-maxrate", r.maxrate, "-bufsize", r.maxrate.replace(/(\d+)/, (n) => String(Number(n) * 2)),
         "-profile:v", "high", "-tune", "film"]
      : ["-c:v", "libsvtav1", "-preset", "6", "-crf", String(r.crf), "-svtav1-params", "tune=0"];
  const tmp = `${file}.part.mp4`;
  await mkdir(DIST, { recursive: true });
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-stats", "-y",
    "-i", mezz.file,
    "-filter_complex", graph, "-map", "[out]", "-an",
    ...codec,
    "-g", String(FPS), "-keyint_min", String(FPS), "-sc_threshold", "0",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    tmp,
  ]);
  await rename(tmp, file);
  await mkdir(join(CACHE, "stamps"), { recursive: true });
  await writeFile(stamp, JSON.stringify({ key }));
  return { r, file, name, height };
}

/** The `codecs` a browser is asked about, read from the file rather than assumed. */
function codecsOf(p) {
  if (p.codec === "h264") {
    const profile = { High: "6400", Main: "4d00", "Constrained Baseline": "42e0", Baseline: "4200" }[p.profile] ?? "6400";
    return `avc1.${profile}${Number(p.level).toString(16).padStart(2, "0")}`;
  }
  if (p.codec === "av1") {
    // Main profile, 8-bit, at the level the encoder chose (its seq_level_idx).
    const level = Number.isFinite(Number(p.level)) && Number(p.level) >= 0 ? Number(p.level) : p.height > 720 ? 8 : 5;
    return `av01.0.${String(level).padStart(2, "0")}M.08`;
  }
  return p.codec;
}

async function poster(c, from) {
  const still = join(DIST, `${c.id}.poster.jpg`);
  const blur = join(DIST, `${c.id}.veil.jpg`);
  await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", from, "-frames:v", "1", "-q:v", "4", still]);
  await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", from, "-frames:v", "1",
    "-vf", "scale=96:-2,gblur=sigma=6", "-q:v", "6", blur]);
  return { still, blur };
}

// ── the run ──────────────────────────────────────────────────────────────────

if (!existsSync(MANIFEST)) {
  console.log(`No ${relative(ROOT, MANIFEST)} yet: no clip has been chosen, so there is nothing to fetch.`);
  process.exit(0);
}
const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
/** @type {Clip[]} */
const clips = manifest.clips ?? [];
clips.forEach(check);
const ids = new Set();
for (const c of clips) {
  if (ids.has(c.id)) throw new Error(`footage.json: two clips are called ${c.id}`);
  ids.add(c.id);
}
const chosen = ONLY ? clips.filter((c) => c.id === ONLY) : clips;
if (ONLY && !chosen.length) throw new Error(`footage.json has no clip called ${ONLY}`);

if (PLAN) {
  let total = 0;
  for (const c of chosen) {
    const seconds = c.out - c.in;
    const est = c.source.size && c.source.duration ? (c.source.size * seconds) / c.source.duration : undefined;
    if (est && c.approved) total += est;
    const size = est ? `≈${(est / 1e6).toFixed(1)} MB` : "size unknown";
    console.log(`${c.approved ? "fetch" : "skip "}  ${c.id}  ${seconds.toFixed(1)} s of ${c.source.url}  (${size})${c.approved ? "" : "  — not approved"}`);
  }
  console.log(`\n${chosen.filter((c) => c.approved).length} approved of ${chosen.length}; about ${(total / 1e6).toFixed(0)} MB would be read.`);
  process.exit(0);
}

const index = existsSync(INDEX) ? JSON.parse(await readFile(INDEX, "utf8")) : { clips: [] };
const kept = new Map((index.clips ?? []).map((e) => [e.id, e]));

for (const c of chosen) {
  if (!c.approved) {
    console.log(`skipping ${c.id}: not approved`);
    continue;
  }
  console.log(`\n${c.id}: ${c.source.title}`);
  const src = /^https?:/.test(c.source.url) ? c.source.url : fromRoot(c.source.url);
  const mezz = await mezzanine(c, src);
  const info = await probe(mezz.file);
  const made = [];
  for (const { r, height } of renditionsFor(info.height)) {
    const e = await encode(c, mezz, info, r, height);
    const p = await probe(e.file);
    made.push({
      src: e.name,
      type: "video/mp4",
      codecs: codecsOf(p),
      height: p.height,
      width: p.width,
      bytes: statSync(e.file).size,
    });
  }
  const first = join(DIST, made[0].src);
  await poster(c, first);
  const out = await probe(first);
  kept.set(c.id, {
    id: c.id,
    signs: c.signs,
    ...(c.passages ? { passages: c.passages } : {}),
    seconds: Number(out.duration.toFixed(3)),
    ...(c.loop ? { loop: true } : {}),
    ...(c.motion ? { motion: c.motion } : {}),
    files: made,
    poster: `${c.id}.poster.jpg`,
    veil: `${c.id}.veil.jpg`,
    credit: {
      title: c.source.title,
      ...(c.source.author ? { author: c.source.author } : {}),
      licence: c.source.licence,
      ...(c.source.licenceUrl ? { licenceUrl: c.source.licenceUrl } : {}),
      ...(c.source.credit ? { line: c.source.credit } : {}),
      page: c.source.page,
      modified: true,
    },
  });
  console.log(`  ${made.map((m) => `${m.src} ${(m.bytes / 1e6).toFixed(1)} MB`).join(", ")}`);
}

// Clips no longer in the manifest, or no longer approved, leave the index.
for (const id of [...kept.keys()]) {
  const c = clips.find((x) => x.id === id);
  if (!c || !c.approved) kept.delete(id);
}
await mkdir(dirname(INDEX), { recursive: true });
await writeFile(INDEX, JSON.stringify({ recipe: RECIPE, clips: [...kept.values()] }, null, 1) + "\n");
const shown = relative(ROOT, INDEX);
console.log(`\n${kept.size} clips in ${shown.startsWith("..") ? INDEX : shown}; encodings in ${DIST}`);
