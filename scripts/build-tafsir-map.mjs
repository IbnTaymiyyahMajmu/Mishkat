/**
 * How much each work of the library says, ayah by ayah.
 *
 * The tafsir page compares works, and the first thing a reader comparing them
 * wants to know is which of them have anything on this ayah, and how much: al-
 * Rāzī can give an ayah forty paragraphs where al-Jalālayn gives it a line.
 * The answer is in this site's copy of each work, but a passage file is a few
 * hundred kilobytes of Arabic, and fifteen of them is a lot to fetch to draw a
 * row of bars. So it is measured once, here, and kept small.
 *
 *   node scripts/build-tafsir-map.mjs        (npm run gen:tafsir-map)
 *
 * For each surah, `public/tafsir-map/<surah>.json` holds every passage of
 * every work this site copies: the ayat it covers and how many words it runs
 * to. That is all. The words counted are the author's — the editor's notes
 * (`[[…]]`) and the printed edition's page marks (`(p-١٧)`) are left out of the
 * count, as the reading view sets them apart from the passage.
 *
 * Nothing here judges a passage. A count is a count: it says where a work
 * speaks at length and where it is brief, and the reader is shown the passage
 * itself a press away.
 *
 * It lives outside `public/tafsir/` because `scripts/mirror-tafsir.mjs` keeps
 * that folder to the works in the catalogue, and would take a folder it does
 * not know for a work that has left it. Run this again after mirroring.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const TAFSIR = new URL("../public/tafsir/", import.meta.url);
const OUT = new URL("../public/tafsir-map/", import.meta.url);
const WORKS = JSON.parse(await readFile(new URL("../src/content/tafsir-mirror.json", import.meta.url), "utf8")).works;

/** The author's words in a stored passage: no page marks, no editor's notes. */
function words(text) {
  const own = text.replace(/\(p-[\d٠-٩]+\)/g, " ").replace(/\[\[[\s\S]*?\]\]/g, " ");
  let n = 0;
  for (const token of own.split(/\s+/)) if (/\p{L}/u.test(token)) n++;
  return n;
}

const bySurah = Array.from({ length: 115 }, () => ({}));
let passages = 0;

for (const id of Object.keys(WORKS).sort()) {
  const index = JSON.parse(await readFile(new URL(`${id}/index.json`, TAFSIR), "utf8"));
  for (const [surah, starts] of Object.entries(index.surahs)) {
    const held = [];
    for (const start of starts) {
      const part = JSON.parse(await readFile(new URL(`${id}/${surah}-${start}.json`, TAFSIR), "utf8"));
      for (const [from, to, text] of part.passages) held.push([from, to, words(text)]);
    }
    if (held.length) bySurah[Number(surah)][id] = held.sort((a, b) => a[0] - b[0]);
    passages += held.length;
  }
  process.stdout.write(`${id} `);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
let bytes = 0;
for (let surah = 1; surah <= 114; surah++) {
  const body = JSON.stringify({ v: 1, surah, works: bySurah[surah] });
  bytes += body.length;
  await writeFile(new URL(`${surah}.json`, OUT), `${body}\n`);
}
console.log(`\n${Object.keys(WORKS).length} works, ${passages.toLocaleString("en")} passages, ${(bytes / 1024).toFixed(0)} KB in 114 files`);
