/**
 * Where the divisions of the printed muṣḥaf fall, for the khatm planner.
 *
 * A plan to finish the Qurʾān in a month is a plan of thirty portions, and a
 * portion should end where a reader can stop: at the end of a juzʾ, a ḥizb or
 * a quarter of one, a rukūʿ, a page, a surah — not in the middle of a passage
 * because the arithmetic said so. This counts, from the corpus, the first ayah
 * of every one of those divisions.
 *
 *   node scripts/build-structure.mjs        (npm run gen:structure)
 *
 * Writes `src/content/structure.json`: for each division, the place among all
 * 6,236 ayat (counted from 1) at which each of its parts begins. Structure, not
 * text.
 */
import { writeFile } from "node:fs/promises";
import { AYAT, structure } from "./corpus-cache.mjs";

const OUT = new URL("../src/content/structure.json", import.meta.url);

const meta = await structure();
const starts = { page: [], rub: [], ruku: [], juz: [], hizb: [], manzil: [], surah: [] };
let index = 0;
let previous = null;
for (let s = 1; s <= 114; s++) {
  starts.surah.push(index + 1);
  for (let a = 1; a <= AYAT[s - 1]; a++) {
    index++;
    const m = meta[s - 1][a - 1];
    for (const [name, field] of [
      ["page", "page"],
      ["rub", "rub"],
      ["ruku", "ruku"],
      ["juz", "juz"],
      ["hizb", "hizb"],
      ["manzil", "manzil"],
    ]) {
      if (!previous || previous[field] !== m[field]) starts[name].push(index);
    }
    previous = m;
  }
}

const expect = { page: 604, rub: 240, juz: 30, hizb: 60, manzil: 7, surah: 114 };
for (const [name, count] of Object.entries(expect)) {
  if (starts[name].length !== count) throw new Error(`${name}: ${starts[name].length} parts, ${count} expected`);
}

/** How many words each ayah has, in one run of 6,236 — what a portion is weighed by. */
const words = (await import("../src/content/ayah-words.json", { with: { type: "json" } })).default.flat();
if (words.length !== 6236) throw new Error(`${words.length} ayat of word counts`);

await writeFile(OUT, JSON.stringify({ v: 1, ...starts }) + "\n", "utf8");
console.log(
  `wrote src/content/structure.json — ${Object.entries(starts)
    .map(([k, v]) => `${v.length} ${k}`)
    .join(", ")}`,
);
