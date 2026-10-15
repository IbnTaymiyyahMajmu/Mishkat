// npm run gen:qari
//
// Where each word falls in a Qari's recitation of each ayah, so that the
// tajweed panel can play a word in a teacher's own voice — cut from his
// recording of the whole ayah — rather than a word read on its own.
//
// The recordings are EveryAyah's (one file to an ayah). The timings are
// quran-align's (Collin Fair, CC BY 4.0), which aligned those recordings
// word by word. Only the murattal recordings of the clearest teaching
// reciters are taken. An ayah whose word count in the timing file is not the
// count this site has for it is left out rather than risk sounding one word
// under another; that is a few in six thousand.
//
// Writes public/qari/<id>/<surah>.json: for each ayah, in order, either null
// (no timing) or each word's [start, end] in milliseconds, by position from 1.
//
//   node scripts/build-qari.mjs           all of them
//   node scripts/build-qari.mjs --stats   say how many ayat each Qari covers

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

const RELEASE =
  "https://github.com/cpfair/quran-align/releases/download/release-2016-11-24/quran-align-data-2016-11-24.zip";
const CACHE = new URL("../node_modules/.cache/mishkat/quran-align/", import.meta.url);
const OUT = new URL("../public/qari/", import.meta.url);

/** The site's id for each Qari, and the name of his recording at EveryAyah. Keep in step with src/lib/audio/qari.ts. */
const QARIS = {
  husary: "Husary_64kbps",
  "husary-muallim": "Husary_Muallim_128kbps",
  minshawi: "Minshawy_Murattal_128kbps",
  "abdul-basit": "Abdul_Basit_Murattal_64kbps",
  tablawi: "Mohammad_al_Tablaway_128kbps",
  afasy: "Alafasy_128kbps",
};

const stats = process.argv.includes("--stats");

async function unpacked() {
  const dir = new URL("data/", CACHE);
  if (existsSync(new URL("Husary_64kbps.json", dir))) return dir;
  await mkdir(CACHE, { recursive: true });
  const zip = new URL("data.zip", CACHE);
  if (!existsSync(zip)) {
    console.log("fetching the quran-align timings…");
    const res = await fetch(RELEASE);
    if (!res.ok) throw new Error(`quran-align: ${res.status}`);
    await writeFile(zip, Buffer.from(await res.arrayBuffer()));
  }
  // `unzip` where there is one; Windows' own tar reads zip files too.
  const zipPath = decodeURIComponent(zip.pathname).replace(/^\/([A-Za-z]:)/, "$1");
  const cachePath = decodeURIComponent(CACHE.pathname).replace(/^\/([A-Za-z]:)/, "$1");
  try {
    execFileSync("unzip", ["-o", "-q", zipPath, "-d", `${cachePath}data`], { stdio: "ignore" });
  } catch {
    await mkdir(dir, { recursive: true });
    execFileSync("tar", ["-xf", zipPath, "-C", `${cachePath}data`], { stdio: "ignore" });
  }
  // The package unpacks either straight into data/ or into data/data/.
  if (!existsSync(new URL("Husary_64kbps.json", dir)) && existsSync(new URL("data/Husary_64kbps.json", dir))) {
    return new URL("data/", dir);
  }
  return dir;
}

const words = JSON.parse(await readFile(new URL("../src/content/ayah-words.json", import.meta.url), "utf8"));
const dir = await unpacked();

await rm(OUT, { recursive: true, force: true });
for (const [id, folder] of Object.entries(QARIS)) {
  const all = JSON.parse(await readFile(new URL(`${folder}.json`, dir), "utf8"));
  const bySurah = Array.from({ length: 114 }, (_, s) => new Array(words[s].length).fill(null));
  let kept = 0;
  for (const a of all) {
    const count = words[a.surah - 1]?.[a.ayah - 1];
    const segments = a.segments ?? [];
    if (!count || !segments.length || Math.max(...segments.map((s) => s[1])) !== count) continue;
    const spans = new Array(count).fill(null);
    // A segment may hold two words the aligner could not part; each of them
    // is given the pair's span, which sounds both rather than the wrong one.
    for (const [from, to, start, end] of segments) {
      for (let w = from; w < to && w < count; w++) spans[w] = [start, end];
    }
    if (spans.some((s) => !s)) continue;
    bySurah[a.surah - 1][a.ayah - 1] = spans;
    kept++;
  }
  await mkdir(new URL(`${id}/`, OUT), { recursive: true });
  for (let s = 0; s < 114; s++) {
    await writeFile(new URL(`${id}/${s + 1}.json`, OUT), JSON.stringify(bySurah[s]));
  }
  console.log(`${id.padEnd(16)} ${kept} of 6236 ayat timed`);
}
if (stats) {
  const files = await readdir(OUT, { recursive: true });
  console.log(`${files.length} files`);
}
