/**
 * The sound every ayah ends on — its fāṣilah — for the rhyme river on each
 * surah's introduction.
 *
 * The Qurʾān is not verse, but its ayat close on sounds that answer each
 * other, and a surah's closing sound holds for a stretch and then turns. The
 * turns are not random: Maryam closes on ـِيًّا for thirty-three ayat, and at
 * the thirty-fourth — "That is ʿĪsā, son of Maryam" — it turns to ـُونَ
 * and ـِيمٍ while the account gives way to the argument about him, and turns
 * back at the forty-first, when the next account begins. Drawn ayah by ayah,
 * the turns are seen to fall where the passages do.
 *
 * What is computed is the ending as it is *said* when the reciter stops on
 * it, which is the only way an ayah's end is ever heard: the last vowel is
 * dropped, tanwīn on alif becomes a long ā, tāʾ marbūṭah becomes h. From that
 * two things are kept:
 *
 *   family   the closing sound, coarse enough that what the ear hears as one
 *            rhyme is one: -ūn, -īn and -īm together (the commonest close in
 *            the Qurʾān, and the one al-Fātiḥah is in), -ān and -ām together,
 *            every close on a long ā together, every close on h together;
 *   letter   the consonant before a closing ā or h — what tells Maryam's
 *            ـِيًّا from its ـدًّا — or before -ūn/-īn, the vowel that carries it.
 *
 *   node scripts/build-rhyme.mjs          (npm run gen:rhyme)
 *   node scripts/build-rhyme.mjs --stats  measure, write nothing
 *
 * Writes `src/content/rhyme.json`: for each surah, a string of one code per
 * ayah. Structure only — a few letters a surah — and not the text.
 */
import { writeFile } from "node:fs/promises";
import { AYAT, isWord, uthmani } from "./corpus-cache.mjs";

const STATS = process.argv.includes("--stats");
const OUT = new URL("../src/content/rhyme.json", import.meta.url);

const ch = (code) => String.fromCodePoint(code);
const cls = (...parts) => new RegExp(`[${parts.join("")}]`, "u");
const span = (a, b) => `${ch(a)}-${ch(b)}`;

const FATHA = ch(0x064e);
const DAMMA = ch(0x064f);
const KASRA = ch(0x0650);
const SHADDA = ch(0x0651);
const SUKUN = ch(0x0652);
const TANWIN = cls(span(0x064b, 0x064d));
const DAGGER = ch(0x0670);
const SMALL_WAW = ch(0x06e5);
const SMALL_YA = ch(0x06e6);

/** Pause signs and other marks above the line that are not part of the word as it is said. */
const ANNOTATION = new RegExp(
  `[${[span(0x06d6, 0x06dc), span(0x06de, 0x06e4), span(0x06e7, 0x06ed), ch(0x0653), ch(0x0654), ch(0x0655), ch(0x0640)].join("")}]`,
  "gu",
);

const ALIF = cls(ch(0x0627), ch(0x0671), ch(0x0622), ch(0x0649)); // ا ٱ آ ى
const VOWEL_MARK = cls(span(0x064b, 0x0652), DAGGER);

/** Split a word into letters, each with the marks on it. */
function letters(word) {
  const out = [];
  for (const c of word) {
    if (VOWEL_MARK.test(c) || c === SMALL_WAW || c === SMALL_YA) {
      if (out.length) out[out.length - 1].marks += c;
      continue;
    }
    out.push({ c, marks: "" });
  }
  return out;
}

/** The opening letters that stand as an ayah on their own, as written without their marks. */
const LETTERED = new Set(["الم", "المص", "الر", "المر", "كهيعص", "طه", "طسم", "طس", "يس", "ص", "حم", "عسق", "ق", "ن"]);

/** How each of those closes when recited — by its name: mīm, ṣād, rā, hā, sīn, qāf, nūn. */
const SPOKEN = { م: "īn|يم", ص: "ād|اد", ر: "ā|را", ه: "ā|ها", س: "īn|ين", ق: "āf|اف", ن: "īn|ون" };

/** Letters as they are named in a code: one Latin letter or digraph each. */
const NAME = {
  ب: "b", ت: "t", ث: "th", ج: "j", ح: "ḥ", خ: "kh", د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh",
  ص: "ṣ", ض: "ḍ", ط: "ṭ", ظ: "ẓ", ع: "ʿ", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n",
  ه: "h", ة: "h", و: "w", ي: "y", ى: "y", ء: "ʾ", أ: "ʾ", إ: "ʾ", ؤ: "ʾ", ئ: "ʾ",
};

/**
 * The ending of one ayah, as `family|letter`.
 *
 *   ā|y   …يًّا        the close on a long ā, with yāʾ before it
 *   h|ʿ   …عَةْ        the close on h (tāʾ marbūṭah or the pronoun), ʿayn before
 *   īn|ū  …ونَ        the nasal close, carried on ū
 *   ān|   …انِ / …امِ
 *   r|    …رْ          a consonant with no long vowel before it
 *   ār| īr| ūr|        a consonant with one — ū and ī rhyme, so both are "ī"
 */
function ending(text) {
  const words = text.trim().split(/\s+/).filter(isWord);
  // An ayah that is the opening letters and nothing else ends on the name of
  // its last letter, as it is recited: الٓمٓ is "alif lām mīm", and closes on -īm.
  if (words.length === 1) {
    const bare = [...words[0]].filter((c) => /[ء-ي]/u.test(c)).join("");
    if (LETTERED.has(bare)) return SPOKEN[bare[bare.length - 1]];
  }
  const word = words[words.length - 1].replace(ANNOTATION, "");
  const ls = letters(word);
  let last = ls[ls.length - 1];
  let before = ls[ls.length - 2];

  // A long ā at the close: tanwīn on a letter followed by alif, alif maqṣūrah,
  // a written alif after fatḥah, or the dagger alif on the last letter.
  if (ALIF.test(last.c) && before) {
    // The alif of "-ū" written after a plural wāw (قَالُوا۟) is not said; the
    // wāw of هُزُوًا, which carries its own vowel, is a consonant before ā.
    if (before.c === "و" && !before.marks.includes(FATHA) && !before.marks.includes(ch(0x064b))) return `ū|و`;
    return `ā|${before.c}${last.c === "ى" ? "ى" : "ا"}`;
  }
  if (last.marks.includes(DAGGER) || (last.c === "ى" && last.marks === "")) return `ā|${before?.c ?? ""}ى`;

  // h: tāʾ marbūṭah, or the pronoun hāʾ when it is the last letter.
  if (last.c === "ة" || (last.c === "ه" && ls.length > 1)) return `h|${before?.c ?? ""}${last.c}`;

  // A long ī or ū with nothing after it: …رَبِّى, …دُعَآءِ is not this.
  if ((last.c === "ي" || last.c === "ى") && !TANWIN.test(last.marks) && !last.marks.match(/[َُ]/u) && before?.marks.includes(KASRA))
    return `ī|ي`;

  // A consonant, and the long vowel before it if there is one.
  const consonant = NAME[last.c] ?? last.c;
  let long = "";
  let said = "";
  if (before) {
    const plain = !before.marks.replace(SHADDA, "").replace(SUKUN, "").match(/[ًٌٍَُِ]/u);
    if (ALIF.test(before.c) || before.marks.includes(DAGGER)) [long, said] = ["ā", "ا"];
    else if (before.c === "و" && plain && ls[ls.length - 3]?.marks.includes(DAMMA)) [long, said] = ["ī", "و"]; // ū rhymes with ī
    else if ((before.c === "ي" || before.c === "ى") && plain && ls[ls.length - 3]?.marks.includes(KASRA)) [long, said] = ["ī", "ي"];
    else if (before.marks.includes(SMALL_WAW)) [long, said] = ["ī", "و"];
    else if (before.marks.includes(SMALL_YA)) [long, said] = ["ī", "ي"];
  }
  said += last.c;
  const nasal = consonant === "n" || consonant === "m";
  if (nasal && long) return `${long === "ā" ? "ān" : "īn"}|${said}`;
  return `${long}${consonant}|${said}`;
}

const text = await uthmani();
const codes = [];
const tally = new Map();
for (let s = 1; s <= 114; s++) {
  const row = [];
  for (let a = 1; a <= AYAT[s - 1]; a++) {
    const code = ending(text[s - 1][a - 1]);
    row.push(code);
    const family = code.split("|")[0];
    tally.set(family, (tally.get(family) ?? 0) + 1);
  }
  codes.push(row);
}

const show = (s) => {
  const row = codes[s - 1];
  const runs = [];
  for (let a = 0; a < row.length; a++) {
    const f = row[a];
    if (runs.length && runs[runs.length - 1].f === f) runs[runs.length - 1].to = a + 1;
    else runs.push({ f, from: a + 1, to: a + 1 });
  }
  return runs.map((r) => `${r.from}${r.to > r.from ? "–" + r.to : ""} ${r.f}`).join(" · ");
};

if (STATS) {
  console.log([...tally].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f || "∅"} ${n}`).join("  "));
  for (const s of [1, 19, 18, 54, 55, 112, 97, 104, 87, 101, 2]) console.log(`\n${s}: ${show(s).slice(0, 900)}`);
  process.exit(0);
}

const out = {};
codes.forEach((row, i) => (out[i + 1] = row));
await writeFile(OUT, JSON.stringify(out) + "\n", "utf8");
console.log(`wrote src/content/rhyme.json — ${[...tally].length} closing sounds over 6,236 ayat`);
