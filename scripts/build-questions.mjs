/**
 * Every question in the Qurʾān, who asks it, and of whom.
 *
 * The questions are found in the Quranic Arabic Corpus, which tags each
 * interrogative it recognises — the hamza of أَلَمْ and أَفَلَا, هَلْ, كَيْفَ,
 * مَا and مَنْ when they ask, أَيْنَ, مَتَى, أَيَّانَ, أَنَّى, كَمْ and أَيّ. It does
 * not recognise them all: an «أَمْ» that opens a new question (أَمْ يَقُولُونَ
 * شَاعِرٌ) is a conjunction to it, and «قُلْ مَنْ يَرْزُقُكُمْ» a relative. Those
 * were read and added by hand. Who asks each question, and of whom, was
 * written for this site, a line to a question, in
 * `src/content/questions/who.txt`; that file says how.
 *
 * This script holds the two together and refuses to build if they disagree:
 * an interrogative the corpus tags and the file does not answer for, or a
 * line of the file pointing at a word that is not there. Then it works out
 * what the page needs and does not want to work out in a browser:
 *
 *   particle   which word asks — أ، هل، ما… — for the page to sort by;
 *   refrain    whether the question recurs word for word, three times or
 *              more: فَبِأَيِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ thirty-one times.
 *
 *   node scripts/build-questions.mjs        (npm run gen:questions)
 *
 * The corpus is read from a corrected copy of its morphology (mustafa0x/
 * quran-morphology, which renders it in Arabic), at a fixed commit. Its
 * licence asks that the corpus be named, and the page names it.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isWord, uthmani } from "./corpus-cache.mjs";

const COMMIT = "8f38b39016824284f9ed16ae15069ff9102c4acf";
const MORPHOLOGY = `https://raw.githubusercontent.com/mustafa0x/quran-morphology/${COMMIT}/quran-morphology.txt`;
const CACHE = new URL("../node_modules/.cache/mishkat/", import.meta.url);
const WHO = new URL("../src/content/questions/who.txt", import.meta.url);
const OUT = new URL("../src/content/questions/questions.json", import.meta.url);

async function morphology() {
  const file = new URL(`quran-morphology-${COMMIT.slice(0, 8)}.txt`, CACHE);
  try {
    return await readFile(file, "utf8");
  } catch {
    const res = await fetch(MORPHOLOGY);
    if (!res.ok) throw new Error(`${res.status} for the morphology`);
    const text = await res.text();
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, text, "utf8");
    return text;
  }
}

// ── the corpus, word by word ────────────────────────────────────────────────

/** words.get("2:255") → [{ text, tags: [...] }, …] counted from 1 */
const words = new Map();
for (const line of (await morphology()).trim().split("\n")) {
  const [loc, form, , tags] = line.split("\t");
  const [s, a, w] = loc.split(":").map(Number);
  const key = `${s}:${a}`;
  let ayah = words.get(key);
  if (!ayah) words.set(key, (ayah = []));
  const word = (ayah[w - 1] ??= { text: "", tags: [] });
  word.text += form;
  word.tags.push(tags);
}

const isInterrogative = (word) => word.tags.some((t) => /(^|\|)INTG(\||$)/.test(t));

/** Which word asks, as the page sorts by it. */
const PARTICLE = {
  أ: "a", هَل: "hal", ما: "ma", ماذا: "ma", مَن: "man", كَيْف: "kayfa", أَيْن: "ayna", مَتَى: "mata",
  أَيّان: "ayyana", أَنَّى: "anna", كَم: "kam", أَيّ: "ayy",
};

function particleOf(word) {
  if (isInterrogative(word)) {
    const t = word.tags.find((x) => /(^|\|)INTG(\||$)/.test(x));
    const m = /LEM:([^|]+)/.exec(t);
    return PARTICLE[m?.[1]] ?? "a";
  }
  // Added by hand: an «am» that opens a question, or an interrogative the
  // corpus reads as something else.
  if (word.tags.some((t) => /LEM:أَم(\||$)/.test(t))) return "am";
  if (word.tags.some((t) => /LEM:مَن(\||$)/.test(t))) return "man";
  if (word.tags.some((t) => /LEM:ما(\||$)/.test(t))) return "ma";
  if (word.tags.some((t) => /LEM:كَم(\||$)/.test(t))) return "kam";
  return null;
}

// ── who asks whom ───────────────────────────────────────────────────────────

const lines = (await readFile(WHO, "utf8")).split("\n");
const errors = [];
const entries = [];
const seen = new Set();
lines.forEach((raw, i) => {
  const line = raw.replace(/#.*$/, "").trim();
  if (!line) return;
  const [loc, what, ...rest] = line.split(/\s+/);
  const where = `who.txt:${i + 1}`;
  const m = /^(\d+):(\d+):(\d+)$/.exec(loc);
  if (!m) return errors.push(`${where}: "${loc}" is not surah:ayah:word`);
  const [s, a, w] = m.slice(1).map(Number);
  const word = words.get(`${s}:${a}`)?.[w - 1];
  if (!word) return errors.push(`${where}: ${loc} is not a word of the corpus`);
  if (seen.has(loc)) return errors.push(`${where}: ${loc} is answered twice`);
  seen.add(loc);

  const tagged = isInterrogative(word);
  const particle = particleOf(word);
  if (!particle) return errors.push(`${where}: ${loc} (${word.text}) is not a word that can ask a question`);
  if (what === "x") {
    if (!tagged) errors.push(`${where}: ${loc} is marked "not a question" but the corpus never said it was`);
    return;
  }
  const scene = rest.find((r) => r.startsWith("@"))?.slice(1) ?? "";
  if (scene && scene !== "day" && scene !== "death") errors.push(`${where}: unknown scene @${scene}`);
  const disputed = rest.includes("?");
  if (what === "indirect") {
    entries.push({ s, a, w, particle, asker: "", asked: "", scene, disputed, indirect: true, added: !tagged });
    return;
  }
  const pair = /^([a-z]+)>([a-z]+)$/.exec(what);
  if (!pair) return errors.push(`${where}: "${what}" is not asker>asked`);
  entries.push({ s, a, w, particle, asker: pair[1], asked: pair[2], scene, disputed, indirect: false, added: !tagged });
});

// Every interrogative the corpus tags is answered for.
for (const [key, ayah] of words) {
  ayah.forEach((word, i) => {
    if (isInterrogative(word) && !seen.has(`${key}:${i + 1}`)) {
      errors.push(`${key}:${i + 1} (${word.text}) is tagged as a question and who.txt does not say who asks it`);
    }
  });
}

if (errors.length) {
  console.error(errors.slice(0, 40).join("\n"));
  console.error(`${errors.length} problems; nothing written`);
  process.exit(1);
}

// ── the corpus's words against the text the site shows ──────────────────────
//
// The page lights the question in the ayah as the Foundation's text gives it,
// counting words as the corpus does. Where the two count differently the
// light would fall on the wrong word, so the ayat where they do are named.

const shown = await uthmani();
const miscounted = [];
for (const e of entries) {
  const text = shown[e.s - 1][e.a - 1];
  const count = text.split(/\s+/).filter(isWord).length;
  if (count !== words.get(`${e.s}:${e.a}`).length) miscounted.push(`${e.s}:${e.a}`);
}

// ── refrains ────────────────────────────────────────────────────────────────

const ch = (code) => String.fromCodePoint(code);
const MARKS = new RegExp(`[${ch(0x064b)}-${ch(0x065f)}${ch(0x0670)}${ch(0x06d6)}-${ch(0x06ed)}${ch(0x0640)}]`, "gu");
const plain = (t) => t.replace(MARKS, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي");
const phrase = (e) =>
  words
    .get(`${e.s}:${e.a}`)
    .slice(e.w - 1, e.w + 2)
    .map((x) => plain(x.text))
    .join(" ");

const byPhrase = new Map();
for (const e of entries) {
  if (e.indirect) continue;
  const p = phrase(e);
  if (p.split(" ").length < 2) continue;
  byPhrase.set(p, [...(byPhrase.get(p) ?? []), e]);
}
const refrains = [...byPhrase]
  .filter(([, list]) => list.length >= 3)
  .sort((x, y) => y[1].length - x[1].length);
refrains.forEach(([, list], i) => list.forEach((e) => (e.refrain = i + 1)));

// ── written ─────────────────────────────────────────────────────────────────

const rows = entries.map((e) => [
  `${e.s}:${e.a}`,
  e.w,
  e.particle,
  e.asker,
  e.asked,
  e.scene,
  (e.disputed ? 1 : 0) | (e.indirect ? 2 : 0) | (e.added ? 4 : 0),
  e.refrain ?? 0,
]);

const file = {
  v: 1,
  source: `Quranic Arabic Corpus morphology 0.4, via mustafa0x/quran-morphology@${COMMIT.slice(0, 7)}`,
  // [key, word, particle, asker, asked, scene, flags (1 disputed · 2 within a sentence · 4 added by hand), refrain]
  questions: rows,
  // The words each refrain is, as the corpus spells them, and how often.
  refrains: refrains.map(([, list]) => [list[0].s, list[0].a, list[0].w, list.length]),
};
await writeFile(OUT, JSON.stringify(file) + "\n", "utf8");

const asked = entries.filter((e) => !e.indirect);
console.log(
  `wrote src/content/questions/questions.json — ${asked.length} questions ` +
    `(${entries.filter((e) => e.added).length} added by hand), ${entries.length - asked.length} within a sentence, ${refrains.length} refrains`,
);
console.log(refrains.slice(0, 12).map(([p, list]) => `  ${list.length}× ${p}`).join("\n"));
if (miscounted.length) console.log(`the corpus and the text count words differently in ${miscounted.length} ayat: ${miscounted.slice(0, 20).join(" ")}`);
