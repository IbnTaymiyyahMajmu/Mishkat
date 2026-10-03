/**
 * Copy the tafsir library from tafsir.app into this site.
 *
 *   node scripts/mirror-tafsir.mjs                 every work in the catalogue
 *   node scripts/mirror-tafsir.mjs tabari alrazi   just these
 *   node scripts/mirror-tafsir.mjs --verify        check what is already here
 *   node scripts/mirror-tafsir.mjs --force saadi   fetch again from scratch
 *   node scripts/mirror-tafsir.mjs --concurrency 4
 *
 * tafsir.app (الباحث القرآني) is Nuqayah's, and this is done with their
 * permission. It is their text, their digitising and their proofreading, and
 * every file written here says so.
 *
 * ── what it produces ──────────────────────────────────────────────────────
 *
 *   public/tafsir/<work>/index.json      where each surah's passages are kept
 *   public/tafsir/<work>/<s>-<a>.json    the passages, a readable size at a time
 *   public/tafsir/<work>/about.json      what tafsir.app says about the work
 *   public/tafsir/SOURCE.md              where all of it came from
 *   src/content/tafsir-mirror.json       which works are here, for the build
 *
 * ── how it goes about it ──────────────────────────────────────────────────
 *
 * A passage is the author's treatment of one ayah, or of a run of them: Ibn
 * ʿĀshūr takes the first fourteen ayat of al-Takwīr together. tafsir.app says
 * which ayat a passage covers, so each is fetched once and stored once against
 * its range, rather than fourteen times under fourteen ayat. Its own index of
 * which ayat a work has anything on is used to skip the rest. Between them
 * those two facts cut a quarter of a million requests to a good deal fewer.
 *
 * Nothing in a passage is altered. It is stored as it was served, with its
 * editors' footnotes and its page markers; what to show and how is for the
 * site to decide when it reads it, and can be decided again without fetching
 * anything a second time.
 *
 * A surah that has been fetched is kept in a cache as soon as it is complete,
 * so stopping the script — or the network stopping it — loses a surah at most.
 * Run it again and it carries on. A work's files are written only when every
 * surah of it has arrived, so the site never holds half a book.
 *
 * It is a guest on someone else's server: a handful of requests at a time, a
 * pause when asked to slow down, and a name in the User-Agent to be found by.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "tafsir");
const CACHE = path.join(ROOT, "node_modules", ".cache", "tafsir-mirror");
const MANIFEST = path.join(ROOT, "src", "content", "tafsir-mirror.json");
const CATALOGUE = path.join(ROOT, "src", "lib", "quran", "tafsirWorks.json");
const SURAHS = path.join(ROOT, "src", "lib", "quran", "surahNames.ts");

const ORIGIN = "https://tafsir.app";
const AGENT = "Mishkat-tafsir-mirror/1.0 (a Qur'an reader mirroring with Nuqayah's permission)";

/** The layout of the files. Bump it if the shape below changes. */
const FORMAT = 1;

/**
 * How much text goes in one file, in characters. A reader opens one ayah, and
 * should not have to download al-Ṭabarī on the whole of al-Baqarah to read his
 * page on it — but nor should every ayah be a file of its own, a quarter of a
 * million of them. This is about 200 KB on disk and a quarter of that on the
 * wire. A single passage longer than this is a file by itself.
 */
const PART_CHARS = 120_000;

// ── arguments ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const CONCURRENCY = Math.max(1, Math.min(12, Number(option("concurrency", 6)) || 6));
const named = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--concurrency");

// ── what there is to copy ───────────────────────────────────────────────────

const catalogue = JSON.parse(await readFile(CATALOGUE, "utf8"));
const known = new Set(catalogue.map((w) => w.id));
for (const id of named) {
  if (!known.has(id)) {
    console.error(`"${id}" is not in the catalogue (${path.relative(ROOT, CATALOGUE)}).`);
    process.exit(1);
  }
}
const wanted = named.length ? named : catalogue.map((w) => w.id);

/** How many ayat each surah has, read off the table the site is built from. */
const AYAT = [...(await readFile(SURAHS, "utf8")).matchAll(/ayat:\s*(\d+)/g)].map((m) => +m[1]);
if (AYAT.length !== 114 || AYAT.reduce((a, b) => a + b, 0) !== 6236) {
  console.error("Could not read the 114 surah lengths from surahNames.ts.");
  process.exit(1);
}

/** tafsir.app numbers the ayat of the muṣḥaf 1 to 6236; this is that number. */
const before = [];
AYAT.reduce((sum, n, i) => ((before[i] = sum), sum + n), 0);
const serial = (surah, ayah) => before[surah - 1] + ayah;

// ── asking ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

/** One request, tried again with a growing pause if the server or the line falters. */
async function ask(url) {
  let wait = 800;
  for (let attempt = 1; ; attempt++) {
    try {
      requests++;
      const res = await fetch(url, { headers: { "User-Agent": AGENT, Accept: "application/json" } });
      if (res.ok) return await res.json();
      // Asked to slow down, or the server is having a moment: both pass.
      if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} for ${url}`);
      const after = Number(res.headers.get("retry-after"));
      if (Number.isFinite(after) && after > 0) wait = Math.max(wait, after * 1000);
    } catch (error) {
      if (attempt >= 6 || /^4\d\d for /.test(String(error?.message))) throw error;
    }
    if (attempt >= 6) throw new Error(`gave up on ${url}`);
    await sleep(wait);
    wait = Math.min(wait * 2, 30_000);
  }
}

/**
 * Which ayat a work has anything on, by tafsir.app's own index. A work with no
 * list has something on every ayah; `keys_flag` says whether a list is of the
 * ayat present or of the ayat absent.
 */
function coverage(source) {
  const keys = Array.isArray(source?.keys) ? new Set(source.keys) : null;
  if (!keys || keys.size === 0) return () => true;
  return source.keys_flag === 1 ? (n) => keys.has(n) : (n) => !keys.has(n);
}

/** Every passage of one work in one surah, in order, each fetched once. */
async function fetchSurah(id, surah, has) {
  const passages = [];
  let covered = 0; // the last ayah already inside a passage

  for (let ayah = 1; ayah <= AYAT[surah - 1]; ayah++) {
    if (ayah <= covered || !has(serial(surah, ayah))) continue;
    const answer = await ask(`${ORIGIN}/get.php?src=${id}&s=${surah}&a=${ayah}&ver=1`);
    const text = typeof answer?.data === "string" ? answer.data.trimEnd() : "";
    if (!text) continue;

    // A run of ayat taken together comes back saying where it begins and how
    // many more it takes in. Anything else is this ayah's alone.
    const start = Number.isInteger(answer.ayahs_start) ? answer.ayahs_start : ayah;
    const more = Number.isInteger(answer.count) && answer.count > 0 ? answer.count : 0;
    // Never reaching back over a passage already kept: one ayah, one passage.
    const from = Math.max(covered + 1, Math.min(start, ayah));
    const to = Math.min(AYAT[surah - 1], Math.max(ayah, start + more));
    passages.push([from, to, text]);
    covered = to;
  }
  return passages;
}

// ── keeping ─────────────────────────────────────────────────────────────────

const cacheFile = (id, surah) => path.join(CACHE, id, `${surah}.json`);

async function cachedSurah(id, surah) {
  try {
    return JSON.parse(await readFile(cacheFile(id, surah), "utf8"));
  } catch {
    return null;
  }
}

/** Run `task` over `items`, a few at a time. */
async function pooled(items, task) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) await task(items[next++]);
    }),
  );
}

/**
 * Write one work out: its passages cut into files of a readable size, and an
 * index saying, for each surah, which ayah each file begins at. To find the
 * passage on an ayah the site takes the last file that begins at or before it.
 */
async function writeWork(id, bySurah, about) {
  const dir = path.join(OUT, id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const index = {};
  let passages = 0;
  let chars = 0;
  let bytes = 0;
  let files = 0;
  let ayat = 0;
  const digest = createHash("sha256");

  for (let surah = 1; surah <= 114; surah++) {
    const all = bySurah[surah] ?? [];
    if (!all.length) continue;
    index[surah] = [];

    let part = [];
    let size = 0;
    const flush = async () => {
      if (!part.length) return;
      const first = part[0][0];
      const body = JSON.stringify({ v: FORMAT, work: id, surah, passages: part });
      await writeFile(path.join(dir, `${surah}-${first}.json`), body);
      index[surah].push(first);
      bytes += Buffer.byteLength(body);
      files++;
      part = [];
      size = 0;
    };

    for (const passage of all) {
      const [from, to, text] = passage;
      if (part.length && size + text.length > PART_CHARS) await flush();
      part.push(passage);
      size += text.length;
      passages++;
      chars += text.length;
      ayat += to - from + 1;
      digest.update(`${surah}:${from}-${to}\n${text}\n`);
    }
    await flush();
  }

  const mirroredAt = new Date().toISOString();
  await writeFile(
    path.join(dir, "index.json"),
    JSON.stringify({ v: FORMAT, work: id, source: `${ORIGIN}/${id}`, mirroredAt, surahs: index }),
  );
  if (about) await writeFile(path.join(dir, "about.json"), JSON.stringify({ v: FORMAT, work: id, text: about }));

  return { passages, ayat, chars, bytes, files, sha256: digest.digest("hex"), mirroredAt };
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return { source: ORIGIN, works: {} };
  }
}

async function writeManifest(manifest) {
  const works = Object.fromEntries(Object.entries(manifest.works).sort(([a], [b]) => a.localeCompare(b)));
  await mkdir(path.dirname(MANIFEST), { recursive: true });
  await writeFile(MANIFEST, `${JSON.stringify({ format: FORMAT, source: ORIGIN, works }, null, 2)}\n`);
}

async function writeSource(manifest) {
  const rows = catalogue
    .filter((w) => manifest.works[w.id])
    .map((w) => {
      const m = manifest.works[w.id];
      return `| ${w.nameArabic} | ${w.name} | ${w.author} | ${m.passages.toLocaleString("en")} | ${(m.bytes / 1e6).toFixed(1)} MB | ${m.mirroredAt.slice(0, 10)} |`;
    });
  const total = Object.values(manifest.works).reduce((n, m) => n + m.bytes, 0);
  await mkdir(OUT, { recursive: true });
  await writeFile(
    path.join(OUT, "SOURCE.md"),
    `# Where these texts come from

Everything in this folder is copied from **[tafsir.app](${ORIGIN})** —
الباحث القرآني — which is built and maintained by **[Nuqayah](https://nuqayah.com)**.
It is copied with their permission.

The texts are the classical tafsir works in the Arabic their authors wrote. The
digitising, the proofreading against the printed editions, and the division of
each work by ayah are Nuqayah's work and their volunteers'. Nothing here has
been altered: each passage is stored as tafsir.app served it, editors' footnotes
and page markers included.

If you are looking for these works, read them at tafsir.app, where they are kept
up to date. If you want to reuse them, ask Nuqayah, not us — the permission to
copy them was given to this site and is not ours to pass on.

Made by \`scripts/mirror-tafsir.mjs\`. ${rows.length} works, ${(total / 1e6).toFixed(0)} MB.

| الكتاب | Work | Author | Passages | Size | Copied |
|---|---|---|---:|---:|---|
${rows.join("\n")}
`,
  );
}

/** Works on disk or on record that the catalogue no longer names. */
async function strays(manifest) {
  const onDisk = existsSync(OUT)
    ? (await readdir(OUT, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
  return [...new Set([...onDisk, ...Object.keys(manifest.works)])].filter((id) => !known.has(id));
}

// ── checking what is already here ───────────────────────────────────────────

async function verify(ids) {
  const manifest = await readManifest();
  let bad = 0;
  for (const id of await strays(manifest)) {
    console.log(`${id.padEnd(18)} BAD  here but not in the catalogue — run the mirror to remove it`);
    bad++;
  }
  for (const id of ids) {
    const record = manifest.works[id];
    const dir = path.join(OUT, id);
    if (!record || !existsSync(path.join(dir, "index.json"))) {
      console.log(`${id.padEnd(18)} not mirrored`);
      continue;
    }
    const index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
    const digest = createHash("sha256");
    let passages = 0;
    let problems = 0;
    for (let surah = 1; surah <= 114; surah++) {
      let last = 0;
      for (const first of index.surahs[surah] ?? []) {
        const file = path.join(dir, `${surah}-${first}.json`);
        if (!existsSync(file)) {
          problems++;
          continue;
        }
        const part = JSON.parse(await readFile(file, "utf8"));
        if (part.passages[0]?.[0] !== first) problems++;
        for (const [from, to, text] of part.passages) {
          // In order, inside the surah, and never two passages on one ayah.
          if (from <= last || to < from || to > AYAT[surah - 1] || !text) problems++;
          last = to;
          passages++;
          digest.update(`${surah}:${from}-${to}\n${text}\n`);
        }
      }
    }
    const listed = (await readdir(dir)).filter((f) => /^\d+-\d+\.json$/.test(f)).length;
    if (listed !== record.files) problems++;
    const same = digest.digest("hex") === record.sha256 && passages === record.passages;
    if (!same || problems) bad++;
    console.log(
      `${id.padEnd(18)} ${same && !problems ? "ok " : "BAD"} ${String(passages).padStart(6)} passages, ${String(record.ayat).padStart(4)} ayat covered, ${(record.bytes / 1e6).toFixed(1).padStart(6)} MB in ${record.files} files`,
    );
  }
  if (bad) {
    console.error(`\n${bad} work(s) do not match what was recorded. Run again with --force for those.`);
    process.exit(1);
  }
}

// ── the run ─────────────────────────────────────────────────────────────────

if (flag("verify")) {
  await verify(wanted);
  process.exit(0);
}

console.log(`Mirroring ${wanted.length} work(s) from ${ORIGIN}, ${CONCURRENCY} requests at a time.`);
const sources = await ask(`${ORIGIN}/sources/sources.json`);
const manifest = await readManifest();

// The catalogue is the list of what this site holds. A work taken out of it is
// taken off the shelf: its files, its record, and what was cached of it.
for (const id of await strays(manifest)) {
  await rm(path.join(OUT, id), { recursive: true, force: true });
  await rm(path.join(CACHE, id), { recursive: true, force: true });
  delete manifest.works[id];
  console.log(`${id.padEnd(18)} is no longer in the catalogue — removed`);
}
await writeManifest(manifest);
await writeSource(manifest);
const began = Date.now();
const failed = [];

for (const id of wanted) {
  if (!sources[id]) {
    console.log(`${id.padEnd(18)} is not on tafsir.app under that name — skipped`);
    failed.push(id);
    continue;
  }
  if (flag("force")) await rm(path.join(CACHE, id), { recursive: true, force: true });
  await mkdir(path.join(CACHE, id), { recursive: true });

  const has = coverage(sources[id]);
  const bySurah = {};
  const todo = [];
  for (let surah = 1; surah <= 114; surah++) {
    const kept = await cachedSurah(id, surah);
    if (kept) bySurah[surah] = kept;
    else todo.push(surah);
  }

  const started = Date.now();
  const asked = requests;
  let done = 114 - todo.length;
  const tick = () =>
    process.stdout.write(`\r${id.padEnd(18)} ${String(done).padStart(3)}/114 surahs  ${requests - asked} requests   `);

  try {
    await pooled(todo, async (surah) => {
      const passages = await fetchSurah(id, surah, has);
      await writeFile(cacheFile(id, surah), JSON.stringify(passages));
      bySurah[surah] = passages;
      done++;
      tick();
    });

    const about = await ask(`${ORIGIN}/get_info.php?src=${id}`).catch(() => null);
    const record = await writeWork(id, bySurah, typeof about?.data === "string" ? about.data.trim() : "");
    manifest.works[id] = record;
    await writeManifest(manifest);
    await writeSource(manifest);
    process.stdout.write(
      `\r${id.padEnd(18)} ${String(record.passages).padStart(6)} passages on ${String(record.ayat).padStart(4)} ayat, ${(record.bytes / 1e6).toFixed(1).padStart(6)} MB in ${String(record.files).padStart(4)} files  (${requests - asked} requests, ${Math.round((Date.now() - started) / 1000)}s)\n`,
    );
  } catch (error) {
    // What was fetched is in the cache; the next run takes up where this left off.
    process.stdout.write(`\r${id.padEnd(18)} stopped: ${error?.message ?? error}\n`);
    failed.push(id);
  }
}

const total = Object.values(manifest.works).reduce((n, m) => n + m.bytes, 0);
console.log(
  `\n${Object.keys(manifest.works).length} work(s) mirrored, ${(total / 1e6).toFixed(0)} MB in all. ${requests} requests in ${Math.round((Date.now() - began) / 60000)} min.`,
);
if (failed.length) {
  console.error(`Not finished: ${failed.join(", ")}. Run the same command again to carry on.`);
  process.exit(1);
}
