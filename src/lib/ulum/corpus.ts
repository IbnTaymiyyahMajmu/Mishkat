import { file } from "./books";

/**
 * The Quranic Arabic Corpus, as `scripts/build-ulum.mjs` leaves it for the
 * ayah study: every word's segments, the trees of the roots, and the runs of
 * words an ayah shares with others.
 *
 * The corpus writes a segment's grammar as a row of tags —
 * `IMPF|VF:1|ROOT:أخذ|LEM:أَخَذَ|3FS|MOOD:IND` — and they are kept as written.
 * `morphology.ts` already says the corpus's tags aloud for the reader, in the
 * form the corpus is served in elsewhere on the site; `toServed` below puts a
 * segment of this copy into that form so that the one reading of the tags
 * serves both, and nothing is said two ways.
 */

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/corpus`;

/** One segment: its letters, the corpus's class (N, V, P), and its tags. */
export type Seg = [form: string, tag: string, features: string];

/** ayat[a - 1][w - 1] — a word is its segments. */
export interface SurahMorph {
  surah: number;
  ayat: Seg[][][];
}

export function fetchMorph(surah: number): Promise<SurahMorph> {
  return file<SurahMorph>(`${BASE}/morph/${surah}.json`);
}

/** [lemma, kind, count, first place] — see `kindOf` in the build script. */
export type Lemma = [lemma: string, kind: string, count: number, first: string];

export interface RootTree {
  /** Words, counted segment by segment, that carry the root. */
  w: number;
  /** Ayat it occurs in. */
  a: number;
  l: Lemma[];
}

export function fetchRoots(): Promise<{ roots: { [root: string]: RootTree } }> {
  return file(`${BASE}/roots.json`);
}

/**
 * The runs of this ayah's words found word for word elsewhere: from, to (words
 * counted from 1), how many other ayat have it, and then pairs of an ayah's
 * place among all 6,236 and the word the run begins at there.
 */
export type EchoRun = number[];

export function fetchEchoes(surah: number): Promise<{ ayat: EchoRun[][] }> {
  return file(`${BASE}/echo/${surah}.json`);
}

/**
 * A hadith Ibn Kathīr brings in on a passage: the ayat the passage covers, the
 * collection (b, m), its number there, and its text and translation there.
 */
/** al-Bukhārī, Muslim, and the four Sunan, these last with al-Albānī's grading. */
export type Collection = "b" | "m" | "d" | "t" | "n" | "j";
export type SahihItem = [from: number, to: number, book: Collection, n: string, arabic: string, english: string, grade?: string];

export function fetchSahih(surah: number): Promise<{ items: SahihItem[] }> {
  return file(`${BASE}/sahih/${surah}.json`);
}

// ── reading a segment ───────────────────────────────────────────────────────

export const tags = (features: string) => features.split("|");
export function field(features: string, name: string): string {
  return tags(features).find((x) => x.startsWith(`${name}:`))?.slice(name.length + 1) ?? "";
}

/** The word's root, from whichever of its segments carries one. */
export function rootOf(word: Seg[]): string {
  for (const [, , f] of word) {
    const r = field(f, "ROOT");
    if (r) return r;
  }
  return "";
}

export function lemmaOf(word: Seg[]): string {
  const stem = word.find(([, , f]) => field(f, "ROOT")) ?? word.find(([, , f]) => !tags(f).includes("PREF") && !tags(f).includes("SUFF"));
  return stem ? field(stem[2], "LEM") : "";
}

/** The part of a word that is neither prefix nor suffix — what the scale weighs. */
export function stemOf(word: Seg[]): Seg | undefined {
  return word.find(([, , f]) => !tags(f).includes("PREF") && !tags(f).includes("SUFF"));
}

const SPELLED: { [tag: string]: string } = {
  N: "Noun",
  PN: "Proper Noun",
  ADJ: "Adjective",
  PRON: "Personal Pronoun",
  DEM: "Demonstrative Pronoun",
  REL: "Relative Pronoun",
  T: "Time Adverb",
  LOC: "Location Adverb",
  V: "Verb",
  P: "Preposition",
  CONJ: "Coordinating Conjunction",
  NEG: "Negative Particle",
  DET: "Determiner",
  INTG: "Interrogative Particle",
  EXP: "Exceptive Particle",
  RES: "Restriction Particle",
  SUB: "Subordinating Conjunction",
  REM: "Resumption Particle",
  CIRC: "Circumstantial Particle",
  EMPH: "Emphatic Particle",
  ACC: "Accusative Particle",
  COND: "Conditional Particle",
  VOC: "Vocative Particle",
  CERT: "Particle of Certainty",
  FUT: "Future Particle",
  RSLT: "Result Particle",
  PRO: "Prohibition Particle",
  PRP: "Purpose Particle",
  IMPV: "Imperative Particle",
  SUP: "Supplemental Particle",
  RET: "Retraction Particle",
  PREV: "Preventive Particle",
  AMD: "Amendment Particle",
  ANS: "Answer Particle",
  AVR: "Aversion Particle",
  CAUS: "Particle of Cause",
  EQ: "Equalization Particle",
  EXH: "Exhortation Particle",
  EXL: "Explanation Particle",
  INC: "Inceptive Particle",
  INT: "Particle of Interpretation",
  SUR: "Surprise Particle",
  INL: "Quranic Initials",
  COM: "Comitative Particle",
  IMPN: "Imperative Verbal Noun",
};

/** The class of a segment, by the corpus's own most particular tag. */
export function classOf([, tag, features]: Seg): string {
  const a = tags(features);
  if (tag === "V") return "V";
  for (const t of ["PN", "PRON", "DEM", "REL", "T", "LOC", "ADJ", "IMPN"]) if (a.includes(t)) return t;
  if (tag === "N") return "N";
  // A particle names itself first: `NEG|LEM:لا`, `P|PREF|LEM:ب`.
  return a.find((t) => SPELLED[t] && t !== "PREF") ?? "P";
}

/** The class spelled out as the corpus spells it, for `sayPos` to translate. */
export function spelledClass(seg: Seg): string {
  return SPELLED[classOf(seg)] ?? classOf(seg);
}

/**
 * A segment of this copy written as the corpus is served elsewhere on the
 * site — `PREFIX|w:CONJ+`, `STEM|POS:V|IMPF|(I)|…` — for `readGrammar`.
 */
const PREFIX_CODE: { [key: string]: string } = {
  "DET:ال": "Al+",
  "P:ب": "bi+",
  "P:ك": "ka+",
  "P:ت": "ta+",
  "FUT:س": "sa+",
  "VOC:يا": "ya+",
  "CONJ:و": "w:CONJ+",
  "REM:و": "w:REM+",
  "CIRC:و": "w:CIRC+",
  "SUP:و": "w:SUP+",
  "COM:و": "w:COM+",
  "P:و": "w:P+",
  "CONJ:ف": "f:CONJ+",
  "REM:ف": "f:REM+",
  "RSLT:ف": "f:RSLT+",
  "CAUS:ف": "f:CAUS+",
  "SUP:ف": "f:SUP+",
  "P:ل": "l:P+",
  "EMPH:ل": "l:EMPH+",
  "PRP:ل": "l:PRP+",
  "IMPV:ل": "l:IMPV+",
  "INTG:أ": "A:INTG+",
};
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function toServed(seg: Seg): string {
  const [, tag, features] = seg;
  const a = tags(features);
  const lemma = field(features, "LEM");
  if (a.includes("PREF")) {
    const fn = a.find((t) => t !== "PREF" && !t.includes(":")) ?? "";
    const code = PREFIX_CODE[`${fn}:${lemma.replace(/[ً-ْ]/g, "")}`];
    return code ? `PREFIX|${code}` : `PREFIX|${fn}`;
  }
  const out: string[] = [a.includes("SUFF") ? "SUFFIX" : "STEM"];
  if (a.includes("SUFF") && a.includes("PRON")) {
    const who = a.find((t) => /^[123]?[MF]?[SDP]$/.test(t) && t !== "P");
    out.push(`PRON:${who ?? ""}`);
    return out.join("|");
  }
  out.push(`POS:${classOf(seg)}`);
  for (const t of a) {
    if (t === "SUFF" || t === classOf(seg)) continue;
    if (t.startsWith("VF:")) {
      out.push(`(${ROMAN[Number(t.slice(3))] ?? t.slice(3)})`);
      continue;
    }
    if (t === "ACT_PCPL") {
      out.push("ACT", "PCPL");
      continue;
    }
    if (t === "PASS_PCPL") {
      out.push("PASS", "PCPL");
      continue;
    }
    if (t.startsWith("FAM:")) {
      const fam: { [k: string]: string } = { "إِنّ": "<in~", "كَان": "kaAn", "كَاد": "kaAd" };
      out.push(`SP:${fam[t.slice(4)] ?? t.slice(4)}`);
      continue;
    }
    if (t === "PRON" && tag !== "N") continue;
    out.push(t);
  }
  return out.join("|");
}

/** The verb form, I to XII, where the segment is a verb or built off one. */
export function formOf(seg: Seg): number {
  return Number(field(seg[2], "VF")) || 0;
}
