/**
 * The corpus, as the generators read it.
 *
 * Several scripts need the whole Qur'an at once — to count it, to match a
 * commentator's quotation against it, to find where its rhyme turns — and
 * none of them should ask the corpus for 114 surahs every time it is run. So
 * each answer is kept on disk, under node_modules/.cache, where it is out of
 * the repository and goes when the dependencies are reinstalled.
 *
 * What the generators keep from it is structure — which ayah, which word, which
 * letter it ends on — and never the text itself: the Foundation's terms do not
 * allow its content to be bundled with the site at build time, and nothing
 * these scripts write into the repository is its content.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";

const API = "https://api.quran.com/api/v4/";
const CACHE = new URL("../node_modules/.cache/mishkat/", import.meta.url);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A path of the corpus, asked once and kept. */
export async function ask(path) {
  const name = path.replace(/[^\w.-]+/g, "_") + ".json";
  const file = new URL(name, CACHE);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    /* not kept yet */
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(API + path);
      if (res.ok) {
        const json = await res.json();
        await mkdir(CACHE, { recursive: true });
        await writeFile(file, JSON.stringify(json), "utf8");
        return json;
      }
      if (res.status < 500 && res.status !== 429) throw new Error(`${res.status} for ${path}`);
    } catch (error) {
      if (attempt >= 5 || /^4\d\d for /.test(String(error?.message))) throw error;
    }
    await sleep(600 * attempt);
  }
}

/** How many ayat each surah has, in order. */
export const AYAT = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77,
  227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62,
  55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19,
  36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

/** Where each surah begins in a count of all 6,236 ayat, from 0. */
export const OFFSET = AYAT.reduce((acc, n, i) => (acc.push(acc[i] + n), acc), [0]);

/** The ayah's place among all 6,236, from 1 — the compact way to name one. */
export const ayahIndex = (surah, ayah) => OFFSET[surah - 1] + ayah;

/** …and back. */
export function ayahAt(index) {
  let s = 1;
  while (OFFSET[s] < index) s++;
  return [s, index - OFFSET[s - 1]];
}

/** The Uthmānī text of every ayah: `text[surah - 1][ayah - 1]`. */
export async function uthmani() {
  const out = [];
  for (let s = 1; s <= 114; s++) {
    const { verses } = await ask(`quran/verses/uthmani?chapter_number=${s}`);
    if (verses.length !== AYAT[s - 1]) throw new Error(`surah ${s}: ${verses.length} ayat, ${AYAT[s - 1]} expected`);
    out.push(verses.map((v) => v.text_uthmani));
  }
  return out;
}

/**
 * Where every ayah falls in the printed muṣḥaf: its page, juzʾ, ḥizb and
 * quarter-ḥizb, and its rukūʿ. `meta[surah - 1][ayah - 1]`.
 */
export async function structure() {
  const out = [];
  for (let s = 1; s <= 114; s++) {
    const rows = [];
    for (let page = 1; rows.length < AYAT[s - 1]; page++) {
      const j = await ask(`verses/by_chapter/${s}?words=false&per_page=50&page=${page}`);
      if (!j.verses?.length) break;
      rows.push(...j.verses);
    }
    if (rows.length !== AYAT[s - 1]) throw new Error(`surah ${s}: ${rows.length} ayat of structure`);
    out.push(
      rows.map((v) => ({
        page: v.page_number,
        juz: v.juz_number,
        hizb: v.hizb_number,
        rub: v.rub_el_hizb_number,
        ruku: v.ruku_number,
        manzil: v.manzil_number,
        sajdah: v.sajdah_number ?? null,
      })),
    );
    process.stdout.write(`\rstructure ${s}/114`);
  }
  process.stdout.write("\n");
  return out;
}

/** A token of the Uthmānī text that is a word, not a pause mark standing alone. */
export const isWord = (token) => /[ء-يٱ-ۓ]/.test(token);
