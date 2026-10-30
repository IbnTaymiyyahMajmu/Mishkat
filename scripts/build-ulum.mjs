/**
 * What the ayah study reads from the Quranic Arabic Corpus, worked out once.
 *
 * The study page sets one ayah out word by word, science by science, and three
 * things it shows are about the whole Qurʾān rather than the ayah alone: how a
 * word's root grows through the muṣḥaf, how often, and where else the ayah's
 * own words are said again. Those are counts over 77,430 words, and a reader's
 * phone should not be the one doing them. So they are done here, from the
 * corpus's morphology, and kept as files the page reads.
 *
 *   node scripts/build-ulum.mjs         (npm run gen:ulum)
 *
 * Writes, under public/corpus/:
 *
 *   morph/<surah>.json   every word of every ayah, segment by segment, with
 *                        the corpus's tags exactly as it writes them;
 *   roots.json           for every root: how many words and ayat it reaches,
 *                        and every lemma that grows from it — what kind of
 *                        word it is, how often it occurs, and where first;
 *   echo/<surah>.json    for every ayah, the runs of its words that stand
 *                        word for word in another ayah, and where;
 *   sahih/<surah>.json   the hadith of al-Bukhārī and Muslim Ibn Kathīr brings
 *                        in on each passage (see the note further down).
 *
 * Nothing here is an opinion. A tag is the corpus's, a count is a count, and an
 * echo is the same words in the same order — found by their consonants, the
 * way `build-xref.mjs` finds a commentator's quotation, so that a vowel or a
 * pause mark does not hide a repetition.
 *
 * The corpus is read from a corrected copy of its morphology (mustafa0x/
 * quran-morphology, which renders it in Arabic), at the commit the other
 * generators read. Its licence asks that the corpus be named, and the page
 * names it.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { AYAT, OFFSET } from "./corpus-cache.mjs";

const COMMIT = "8f38b39016824284f9ed16ae15069ff9102c4acf";
const MORPHOLOGY = `https://raw.githubusercontent.com/mustafa0x/quran-morphology/${COMMIT}/quran-morphology.txt`;
const CACHE = new URL("../node_modules/.cache/mishkat/", import.meta.url);
const OUT = new URL("../public/corpus/", import.meta.url);
const WORDS = new URL("../src/content/ayah-words.json", import.meta.url);

/** A file format number, read by `src/lib/ulum/corpus.ts`. */
const FORMAT = 1;

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

/** ayat[s - 1][a - 1][w - 1] = [[form, tag, features], …] — the word's segments. */
const ayat = AYAT.map((n) => Array.from({ length: n }, () => []));
for (const line of (await morphology()).trim().split("\n")) {
  const [loc, form, tag, features] = line.split("\t");
  const [s, a, w] = loc.split(":").map(Number);
  const words = ayat[s - 1][a - 1];
  (words[w - 1] ??= []).push([form, tag, features]);
}

// The word positions must be the muṣḥaf's own, the ones the rest of the site
// counts by: word 3 of 2:255 here has to be word 3 of 2:255 in the reader.
const counted = JSON.parse(await readFile(WORDS, "utf8"));

// In four places the count taken from the spaces in the text is one more than
// the word list the reader goes by: «بَعْدَ مَا» three times and «إِلْ يَاسِينَ» in
// 37:130 are one word in the list and in the corpus, with a space inside it.
const ONE_WORD_WITH_A_SPACE = new Set(["2:181", "8:6", "13:37", "37:130"]);
let mismatched = 0;
for (let s = 1; s <= 114; s++) {
  for (let a = 1; a <= AYAT[s - 1]; a++) {
    const here = ayat[s - 1][a - 1];
    const expected = counted[s - 1][a - 1] - (ONE_WORD_WITH_A_SPACE.has(`${s}:${a}`) ? 1 : 0);
    if (here.some((w) => !w) || here.length !== expected) {
      mismatched++;
      if (mismatched <= 5) console.warn(`${s}:${a}: ${here.length} words here, ${counted[s - 1][a - 1]} in the muṣḥaf`);
    }
  }
}
if (mismatched) throw new Error(`${mismatched} ayat do not have the muṣḥaf's word count`);

const atoms = (features) => features.split("|");
const field = (features, name) => atoms(features).find((x) => x.startsWith(`${name}:`))?.slice(name.length + 1) ?? "";

// ── the roots ───────────────────────────────────────────────────────────────

/**
 * What kind of word a stem is, in the few classes a root's tree is drawn by:
 * a verb by its form, a participle or verbal noun by its form, and the rest by
 * what the corpus calls them. The class is the corpus's, put into a short key.
 */
function kindOf(tag, features) {
  const a = atoms(features);
  const form = field(features, "VF") || "1";
  if (tag === "V") return `V${form}`;
  if (a.includes("ACT_PCPL")) return `AP${form}`;
  if (a.includes("PASS_PCPL")) return `PP${form}`;
  if (a.includes("VN")) return `VN${form}`;
  if (a.includes("PN")) return "PN";
  if (a.includes("ADJ")) return "ADJ";
  if (a.includes("LOC") || a.includes("T")) return "ADV";
  return "N";
}

const roots = new Map();
const serial = (s, a) => OFFSET[s - 1] + a;
for (let s = 1; s <= 114; s++) {
  for (let a = 1; a <= AYAT[s - 1]; a++) {
    ayat[s - 1][a - 1].forEach((segments, w) => {
      for (const [, tag, features] of segments) {
        const root = field(features, "ROOT");
        if (!root) continue;
        const lemma = field(features, "LEM");
        let r = roots.get(root);
        if (!r) roots.set(root, (r = { words: 0, ayat: new Set(), lemmas: new Map() }));
        r.words++;
        r.ayat.add(serial(s, a));
        const kind = kindOf(tag, features);
        const id = `${lemma}\t${kind}`;
        const l = r.lemmas.get(id) ?? { lemma, kind, count: 0, first: `${s}:${a}:${w + 1}` };
        l.count++;
        r.lemmas.set(id, l);
      }
    });
  }
}

const rootsOut = {};
for (const [root, r] of [...roots].sort(([x], [y]) => x.localeCompare(y, "ar"))) {
  rootsOut[root] = {
    w: r.words,
    a: r.ayat.size,
    // Commonest first: the shape a root mostly takes is the one to meet first.
    l: [...r.lemmas.values()].sort((x, y) => y.count - x.count).map((l) => [l.lemma, l.kind, l.count, l.first]),
  };
}

// ── the echoes ──────────────────────────────────────────────────────────────

const ch = (code) => String.fromCodePoint(code);
const span = (a, b) => `${ch(a)}-${ch(b)}`;

/** The same skeleton `build-xref.mjs` compares quotations by; see the note there. */
const DROP = new RegExp(
  `[${[
    span(0x0610, 0x061a),
    span(0x064b, 0x065f),
    ch(0x0670),
    span(0x06d6, 0x06ed),
    ch(0x0640),
    ch(0x0627),
    span(0x0671, 0x0673),
    ch(0x0675),
    span(0x0621, 0x0626),
    ch(0x0649),
    ch(0x0648),
    ch(0x064a),
    ch(0x06cc),
  ].join("")}]`,
  "gu",
);
const NOT_LETTER = new RegExp(`[^${span(0x0621, 0x064a)}]`, "gu");
function skeleton(text) {
  const bare = text.replace(DROP, "").replaceAll(ch(0x0629), ch(0x062a)).replace(NOT_LETTER, "");
  let out = "";
  for (const c of bare) if (c !== out[out.length - 1]) out += c;
  return out;
}

/**
 * A word as the echoes compare it: its skeleton, and whether it carries a root.
 * A run of particles — «مِن ٱلَّذِينَ» — recurs everywhere and echoes nothing,
 * so a run must hold at least two words that have a root to count.
 */
const flat = []; // every word of the muṣḥaf: { key: serial, w, sk, rooted }
const startOf = []; // startOf[serial] = index in `flat` of the ayah's first word
for (let s = 1; s <= 114; s++) {
  for (let a = 1; a <= AYAT[s - 1]; a++) {
    startOf[serial(s, a)] = flat.length;
    ayat[s - 1][a - 1].forEach((segments, w) => {
      flat.push({
        key: serial(s, a),
        w: w + 1,
        sk: skeleton(segments.map(([form]) => form).join("")),
        rooted: segments.some(([, , f]) => field(f, "ROOT")),
      });
    });
  }
}

const LEAST_WORDS = 3;
const LEAST_ROOTED = 2;
/** At most this many other ayat are kept for one run of words, longest first. */
const KEEP = 14;

/** Where every three-word run of skeletons stands. */
const grams = new Map();
for (let i = 0; i + 2 < flat.length; i++) {
  if (flat[i].key !== flat[i + 2].key) continue; // runs stay inside an ayah
  const g = `${flat[i].sk} ${flat[i + 1].sk} ${flat[i + 2].sk}`;
  (grams.get(g) ?? grams.set(g, []).get(g)).push(i);
}

const echoes = AYAT.map((n) => Array.from({ length: n }, () => []));
let echoCount = 0;
for (let s = 1; s <= 114; s++) {
  for (let a = 1; a <= AYAT[s - 1]; a++) {
    const key = serial(s, a);
    const first = startOf[key];
    const n = ayat[s - 1][a - 1].length;
    /** Every run this ayah shares, by the other ayah and where it starts in each. */
    const best = new Map();
    for (let i = first; i + 2 < first + n; i++) {
      const g = `${flat[i].sk} ${flat[i + 1].sk} ${flat[i + 2].sk}`;
      for (const j of grams.get(g) ?? []) {
        if (flat[j].key === key) continue;
        // Only a run's first word starts it: a run already seen one word back is the same run.
        if (i > first && j > 0 && flat[j - 1].key === flat[j].key && flat[i - 1].sk === flat[j - 1].sk) continue;
        let len = 3;
        while (i + len < first + n && flat[j + len]?.key === flat[j].key && flat[i + len].sk === flat[j + len].sk) len++;
        let rooted = 0;
        for (let k = 0; k < len; k++) if (flat[i + k].rooted) rooted++;
        if (len < LEAST_WORDS || rooted < LEAST_ROOTED) continue;
        const other = flat[j].key;
        // One ayah can echo two stretches of this one — 42:4 has both «لَهُۥ مَا فِى
        // ٱلسَّمَٰوَٰتِ…» and «وَهُوَ ٱلْعَلِىُّ ٱلْعَظِيمُ» of 2:255 — so each run is its own.
        best.set(`${other}@${i}@${j}`, { len, at: i - first + 1, other, otherAt: flat[j].w });
      }
    }
    const runs = [...best.values()].sort((x, y) => y.len - x.len || x.other - y.other);
    // Grouped by the stretch of this ayah they echo, each stretch keeping its
    // longest few: «إِنَّ ٱللَّهَ عَلَىٰ كُلِّ شَىْءٍ قَدِيرٌ» stands in thirty-odd places.
    const byStretch = new Map();
    for (const r of runs) {
      const id = `${r.at}-${r.len}`;
      const list = byStretch.get(id) ?? byStretch.set(id, []).get(id);
      list.push(r);
    }
    const out = [];
    for (const [id, list] of byStretch) {
      const [at, len] = id.split("-").map(Number);
      out.push([at, at + len - 1, list.length, ...list.slice(0, KEEP).flatMap((r) => [r.other, r.otherAt])]);
      echoCount += list.length;
    }
    out.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
    echoes[s - 1][a - 1] = out;
  }
}

// ── the Ṣaḥīḥ reports Ibn Kathīr brings in ──────────────────────────────────

/**
 * The Sunnah tier of the study carries only what stands in Ṣaḥīḥ al-Bukhārī or
 * Ṣaḥīḥ Muslim, because what is in them needs no grading put beside it. Which
 * reports bear on an ayah is Ibn Kathīr's judgement: the editor of his tafsir
 * gives each hadith he quotes its number in those two books, in a footnote.
 *
 * The text shown is the collection's own, fetched by that number, with the
 * collection's translation. And a number is trusted only if the hadith it
 * names is the one Ibn Kathīr is quoting: the distinctive words of the hadith
 * must stand in his paragraph or the ones either side of it. Tried against
 * every reference with a deliberately wrong number, this passes about one in
 * forty-five; the references it turns away are mostly places he only alludes
 * to a hadith, which stay in his own passage and are not lost.
 */
const HADITH = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/";
const KATHIR = new URL("../public/tafsir/ibn-katheer/", import.meta.url);

async function edition(name) {
  const file = new URL(`hadith-${name}.json`, CACHE);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    const res = await fetch(`${HADITH}${name}.min.json`);
    if (!res.ok) throw new Error(`${res.status} for ${name}`);
    const text = await res.text();
    await writeFile(file, text, "utf8");
    return JSON.parse(text);
  }
}

/** The collection by the number the editor uses, each number's narrations with their translations. */
async function collection(arabicName, englishName, numberOf) {
  const english = new Map();
  const graded = new Map();
  for (const h of (await edition(englishName)).hadiths) {
    english.set(h.hadithnumber, h.text?.trim() ?? "");
    const albani = h.grades?.find((g) => /albani/i.test(g.name))?.grade?.trim();
    if (albani) graded.set(h.hadithnumber, albani);
  }
  const out = new Map();
  for (const h of (await edition(arabicName)).hadiths) {
    if (!h.text?.trim()) continue;
    const n = numberOf(h);
    if (!out.has(n)) out.set(n, []);
    out.get(n).push({
      ar: h.text.replaceAll(String.fromCharCode(0x200f), "").trim(),
      en: english.get(h.hadithnumber) ?? "",
      grade: graded.get(h.hadithnumber) ?? "",
    });
  }
  return out;
}

const BUKHARI = await collection("ara-bukhari", "eng-bukhari", (h) => String(Math.floor(Number(h.hadithnumber))));
// Muslim is numbered by ʿAbd al-Bāqī, which the corpus keeps as `arabicnumber`.
const MUSLIM = await collection("ara-muslim", "eng-muslim", (h) => String(Math.floor(parseFloat(h.arabicnumber))));
// The four Sunan, each with al-Albānī's grading where the corpus carries one. A
// hadith with no grading from him is left out, by the owner's ruling.
const byNumber = (h) => String(Math.floor(Number(h.hadithnumber)));
const ABU_DAWUD = await collection("ara-abudawud", "eng-abudawud", byNumber);
const TIRMIDHI = await collection("ara-tirmidhi", "eng-tirmidhi", byNumber);
const NASAI = await collection("ara-nasai", "eng-nasai", byNumber);
const IBN_MAJAH = await collection("ara-ibnmajah", "eng-ibnmajah", byNumber);

const COMMON = new Set(
  [
    "حدثنا", "حدثني", "اخبرنا", "اخبرني", "رسول", "الله", "صلى", "عليه", "وسلم", "النبي", "فقال", "قال", "قالت",
    "عنه", "عنها", "رضي", "الذي", "الذين", "هذا", "هذه", "ذلك", "كان", "كانت", "ابن", "ابو", "ابي", "عبد", "محمد", "بن",
  ].map(skeleton),
);
const tokens = (text) => [
  ...new Set(
    text
      .split(/[^\p{L}\p{M}]+/u)
      .map(skeleton)
      .filter((w) => w.length >= 3 && !COMMON.has(w)),
  ),
];

/** The narration under a number that best matches what Ibn Kathīr quotes, if one does. */
function matching(narrations, around) {
  let top = null;
  for (const h of narrations ?? []) {
    const t = tokens(h.ar);
    const shared = t.filter((w) => around.has(w)).length;
    const ratio = shared / Math.max(1, t.length);
    if (!top || shared > top.shared) top = { ...h, shared, ratio };
  }
  return top && (top.shared >= 10 || (top.ratio >= 0.3 && top.shared >= 4)) ? top : null;
}

const NOTE = /\[\[([\s\S]{0,4000}?)\]\]/g;
const VOWELS = new RegExp(`[${span(0x064b, 0x065f)}]`, "gu");
const DIGITS = "٠١٢٣٤٥٦٧٨٩";
const NUMBERS = "\\(([\\d٠-٩]{1,5}(?:\\s*[،,و]\\s*[\\d٠-٩]{1,5})*)\\)";
const TRACED = [
  ["b", new RegExp(`صحيح\\s+البخاري\\s+برقم\\s*${NUMBERS}`, "gu"), BUKHARI],
  ["m", new RegExp(`صحيح\\s+مسلم\\s+برقم\\s*${NUMBERS}`, "gu"), MUSLIM],
  ["d", new RegExp(`سنن\\s+[أا]بي\\s+داود(?:\\s+برقم)?\\s*${NUMBERS}`, "gu"), ABU_DAWUD],
  ["t", new RegExp(`سنن\\s+الترمذي(?:\\s+برقم)?\\s*${NUMBERS}`, "gu"), TIRMIDHI],
  ["n", new RegExp(`سنن\\s+النسائي(?:\\s+برقم)?\\s*${NUMBERS}`, "gu"), NASAI],
  ["j", new RegExp(`سنن\\s+ابن\\s+ماج[هة](?:\\s+برقم)?\\s*${NUMBERS}`, "gu"), IBN_MAJAH],
];

const sahih = AYAT.map(() => []);
let traced = 0;
const index = JSON.parse(await readFile(new URL("index.json", KATHIR), "utf8"));
for (let s = 1; s <= 114; s++) {
  for (const first of index.surahs[s] ?? []) {
    const part = JSON.parse(await readFile(new URL(`${s}-${first}.json`, KATHIR), "utf8"));
    for (const [from, to, text] of part.passages) {
      const paras = text.replace(/\(p-[\d٠-٩]+\)/g, "").split("\n");
      const kept = new Set();
      paras.forEach((para, i) => {
        for (const note of para.matchAll(NOTE)) {
          const plain = note[1].replace(VOWELS, "");
          // A hadith in the two Ṣaḥīḥs needs no other; the Sunan are for the rest.
          let inTheTwo = false;
          for (const [book, re, narrations] of TRACED) {
            const fromSunan = book !== "b" && book !== "m";
            if (fromSunan && inTheTwo) continue;
            for (const m of plain.matchAll(re)) {
              for (const raw of m[1].split(/[،,و]/)) {
                const n = raw.trim().replace(/[٠-٩]/g, (d) => String(DIGITS.indexOf(d)));
                if (!n || kept.has(`${book}${n}`)) continue;
                traced++;
                const around = new Set(tokens([paras[i - 1] ?? "", para, paras[i + 1] ?? ""].join(" ").replace(NOTE, " ")));
                const h = matching(narrations.get(n), around);
                if (!h || (fromSunan && !h.grade)) continue;
                kept.add(`${book}${n}`);
                if (!fromSunan) inTheTwo = true;
                sahih[s - 1].push(fromSunan ? [from, to, book, n, h.ar, h.en, h.grade] : [from, to, book, n, h.ar, h.en]);
              }
            }
          }
        }
      });
    }
  }
}

// ── writing ─────────────────────────────────────────────────────────────────

await rm(OUT, { recursive: true, force: true });
await mkdir(new URL("morph/", OUT), { recursive: true });
await mkdir(new URL("echo/", OUT), { recursive: true });
await mkdir(new URL("sahih/", OUT), { recursive: true });

let bytes = 0;
const put = async (rel, data) => {
  const body = JSON.stringify(data);
  bytes += Buffer.byteLength(body);
  await writeFile(new URL(rel, OUT), body);
};

for (let s = 1; s <= 114; s++) {
  await put(`morph/${s}.json`, { v: FORMAT, surah: s, ayat: ayat[s - 1] });
  await put(`echo/${s}.json`, { v: FORMAT, surah: s, ayat: echoes[s - 1] });
  await put(`sahih/${s}.json`, { v: FORMAT, surah: s, items: sahih[s - 1] });
}
await put("roots.json", { v: FORMAT, roots: rootsOut });
await writeFile(
  new URL("SOURCE.md", OUT),
  `# Where these files come from

They are worked out by \`scripts/build-ulum.mjs\` from the morphology of the
**[Quranic Arabic Corpus](https://corpus.quran.com)** (Kais Dukes, Language
Research Group, University of Leeds), as corrected and rendered in Arabic by
[mustafa0x/quran-morphology](https://github.com/mustafa0x/quran-morphology) at
commit \`${COMMIT.slice(0, 7)}\`. The corpus is free software under the GNU
General Public License; its tags are kept here exactly as it writes them.

- \`morph/<surah>.json\` — every word of every ayah, segment by segment.
- \`roots.json\` — each root's lemmas, their kinds and counts.
- \`echo/<surah>.json\` — runs of three or more words an ayah shares, word for
  word, with another.
- \`sahih/<surah>.json\` — the hadith of al-Bukhārī, Muslim, Abū Dāwūd, al-Tirmidhī,
  al-Nasāʾī and Ibn Mājah that Ibn Kathīr quotes on each passage, by the number his
  editor gives, in the text and translation of
  [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api), kept only
  where the text matches what he quotes. Those of the four Sunan carry al-Albānī's
  grading as that corpus gives it, and one without a grading is left out.
`,
);

console.log(
  `${roots.size} roots, ${flat.length} words, ${echoCount} echoes, ${sahih.flat().length} of ${traced} Ṣaḥīḥ references confirmed. ${(bytes / 1e6).toFixed(1)} MB in public/corpus.`,
);
