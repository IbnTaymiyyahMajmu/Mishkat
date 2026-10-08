/**
 * Regenerates `src/lib/quran/surahFacts.ts` and `src/content/ayah-words.json`
 * from the corpus.
 *
 * An introduction to a surah opens with things that are counted rather than
 * written: where it stands in the muṣḥaf and in the order of revelation, how
 * many ayat and words it has, which pages and juz' it runs through, where its
 * prostrations are. None of that should be typed by hand, and none of it
 * should wait on a network call when the page is opened — so it is counted
 * here, once, and baked in.
 *
 * What is taken from the corpus is its structure, not its content: numbers of
 * pages, juz' and paragraphs, and a count of the words. The one stretch of
 * text kept is the letters the twenty-nine surahs that open with letters open
 * with.
 *
 *   node scripts/generate-surah-facts.mjs      (npm run gen:facts)
 */
import { writeFile } from "node:fs/promises";

const API = "https://api.quran.com/api/v4/";
const FACTS = new URL("../src/lib/quran/surahFacts.ts", import.meta.url);
const WORDS = new URL("../src/content/ayah-words.json", import.meta.url);

/** The surahs that open with letters — الحروف المقطّعة. */
const LETTERED = new Set([
  2, 3, 7, 10, 11, 12, 13, 14, 15, 19, 20, 26, 27, 28, 29, 30, 31, 32, 36, 38, 40, 41, 42, 43, 44, 45, 46, 50, 68,
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(path) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(API + path);
      if (res.ok) return await res.json();
      if (res.status < 500 && res.status !== 429) throw new Error(`${res.status} for ${path}`);
    } catch (error) {
      if (attempt >= 5 || /^4\d\d for /.test(String(error?.message))) throw error;
    }
    await sleep(600 * attempt);
  }
}

/** A token of the Uthmānī text that is a word, not a pause mark standing alone. */
const isWord = (token) => /[ء-يٱ-ۓ]/.test(token);

const { chapters } = await ask("chapters?language=en");
if (!Array.isArray(chapters) || chapters.length !== 114) {
  throw new Error(`expected 114 chapters, received ${chapters?.length}`);
}
chapters.sort((a, b) => a.id - b.id);

const facts = [];
const ayahWords = [];

for (const c of chapters) {
  const { verses: text } = await ask(`quran/verses/uthmani?chapter_number=${c.id}`);
  if (text.length !== c.verses_count) throw new Error(`surah ${c.id}: ${text.length} ayat of text, ${c.verses_count} expected`);
  const counts = text.map((v) => v.text_uthmani.split(/\s+/).filter(isWord).length);

  const meta = [];
  for (let page = 1; meta.length < c.verses_count; page++) {
    const j = await ask(`verses/by_chapter/${c.id}?words=false&per_page=50&page=${page}`);
    if (!j.verses?.length) break;
    meta.push(...j.verses);
  }
  if (meta.length !== c.verses_count) throw new Error(`surah ${c.id}: ${meta.length} ayat of structure, ${c.verses_count} expected`);

  const juz = meta.map((v) => v.juz_number);
  const pages = meta.map((v) => v.page_number);
  const firstWord = (i) => text[i].text_uthmani.trim().split(/\s+/)[0];

  facts.push({
    revealed: c.revelation_order,
    place: c.revelation_place,
    ayat: c.verses_count,
    words: counts.reduce((a, b) => a + b, 0),
    pages: [Math.min(...pages), Math.max(...pages)],
    juz: [Math.min(...juz), Math.max(...juz)],
    ruku: new Set(meta.map((v) => v.ruku_number)).size,
    sajdah: meta.filter((v) => v.sajdah_number).map((v) => v.verse_number),
    // ash-Shūrā opens with letters over two ayat: حمٓ ۝ عٓسٓقٓ.
    letters: LETTERED.has(c.id) ? (c.id === 42 ? `${firstWord(0)} ${firstWord(1)}` : firstWord(0)) : "",
    basmalah: !!c.bismillah_pre,
  });
  ayahWords.push(counts);
  process.stdout.write(`\r${c.id}/114`);
}
process.stdout.write("\n");

const orders = facts.map((f) => f.revealed).sort((a, b) => a - b);
if (orders.some((n, i) => n !== i + 1)) throw new Error("the order of revelation is not a run from 1 to 114");

const total = facts.reduce((sum, f) => sum + f.words, 0);
const rows = facts
  .map(
    (f) =>
      `  { revealed: ${f.revealed}, place: ${JSON.stringify(f.place)}, ayat: ${f.ayat}, words: ${f.words}, ` +
      `pages: [${f.pages.join(", ")}], juz: [${f.juz.join(", ")}], ruku: ${f.ruku}, ` +
      `sajdah: [${f.sajdah.join(", ")}], letters: ${JSON.stringify(f.letters)}, basmalah: ${f.basmalah} },`,
  )
  .join("\n");

const file = `/**
 * What can be counted about each surah, baked in at build time.
 *
 * Where it stands in the order of revelation, how long it is, which pages and
 * juz' of the muṣḥaf it runs through, where its prostrations fall, and the
 * letters it opens with if it opens with letters. These are the numbers at the
 * head of a surah's introduction, and they are counted from the corpus rather
 * than typed.
 *
 * \`revealed\` is the corpus's own figure: the order printed at the head of
 * each surah in the Egyptian muṣḥaf of 1924, which rests on the lists
 * transmitted from Ibn ʿAbbās and Jābir ibn Zayd. It places a surah by where it
 * began; many came down in parts, over years.
 *
 * \`words\` counts the words of the Uthmānī text, ${total.toLocaleString("en")} in all.
 *
 * Generated by scripts/generate-surah-facts.mjs — run \`npm run gen:facts\`.
 */

export interface SurahFacts {
  /** Its place in the traditional order of revelation, 1 to 114. */
  revealed: number;
  place: "makkah" | "madinah";
  ayat: number;
  words: number;
  /** The first and last page it is on, in the Madīnah muṣḥaf. */
  pages: [number, number];
  /** The first and last juz' it runs through. */
  juz: [number, number];
  /** How many of the muṣḥaf's own paragraphs — rukūʿ — it is divided into. */
  ruku: number;
  /** The ayat of prostration in it. */
  sajdah: number[];
  /** The letters it opens with, or nothing. */
  letters: string;
  /** Whether the basmalah is written at its head. Only at-Tawbah has none. */
  basmalah: boolean;
}

export const SURAH_FACTS: SurahFacts[] = [
${rows}
];

/** The surah that stands at a given place in the order of revelation. */
const BY_REVELATION: number[] = [];
SURAH_FACTS.forEach((f, i) => (BY_REVELATION[f.revealed - 1] = i + 1));

/** Every surah, in the order they began to come down. */
export const REVELATION_ORDER: readonly number[] = BY_REVELATION;

/** How many surahs the traditional list places in Makkah, before the Hijrah. */
export const MAKKAN_COUNT = SURAH_FACTS.filter((f) => f.place === "makkah").length;
`;

await writeFile(FACTS, file, "utf8");
await writeFile(WORDS, JSON.stringify(ayahWords) + "\n", "utf8");
console.log(`wrote 114 surahs — ${total.toLocaleString("en")} words — to src/lib/quran/surahFacts.ts`);
console.log("wrote the words of each ayah to src/content/ayah-words.json");
