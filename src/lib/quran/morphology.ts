/**
 * Reading the corpus's grammar tags back into English.
 *
 * The Quranic Arabic Corpus writes a segment's grammar as a run of short codes:
 * `STEM|POS:N|LEM:kita`b|ROOT:ktb|MS|GEN|INDEF` is a definite-less noun of the
 * root k-t-b, masculine singular, in the genitive. Everything in this file is a
 * lookup table over that vocabulary and nothing else — no code here decides
 * what a word means, only how to say aloud what the corpus already recorded.
 *
 * A code with no entry in the tables is passed through exactly as it arrived.
 * That is deliberate: an unfamiliar tag showing as itself is a gap the reader
 * can see and go and check, where a guessed translation is a claim about the
 * language that nobody made. Same principle as the panel it feeds.
 *
 * Part of speech is not translated here at all. The corpus's own `pos` field
 * arrives already spelled out ("Relative Pronoun", "Accusative Particle"), so
 * repeating that table would only be a second chance to disagree with it.
 */

/** Person, gender and number — the agreement carried by a verb or a pronoun. */
const PERSON: Record<string, string> = {
  "1S": "1st person singular",
  "1P": "1st person plural",
  "2MS": "2nd person masculine singular",
  "2FS": "2nd person feminine singular",
  "2D": "2nd person dual",
  "2MD": "2nd person masculine dual",
  "2FD": "2nd person feminine dual",
  "2MP": "2nd person masculine plural",
  "2FP": "2nd person feminine plural",
  "3MS": "3rd person masculine singular",
  "3FS": "3rd person feminine singular",
  "3D": "3rd person dual",
  "3MD": "3rd person masculine dual",
  "3FD": "3rd person feminine dual",
  "3MP": "3rd person masculine plural",
  "3FP": "3rd person feminine plural",
};

/** Gender and number on a noun, which carries no person to agree with. */
const NUMBER: Record<string, string> = {
  M: "masculine",
  F: "feminine",
  D: "dual",
  P: "plural",
  MS: "masculine singular",
  FS: "feminine singular",
  MD: "masculine dual",
  FD: "feminine dual",
  MP: "masculine plural",
  FP: "feminine plural",
};

/**
 * Case and mood are given with the Arabic term beside the English, because the
 * Arabic is what a grammar book and a teacher will both call it.
 */
const CASE: Record<string, string> = {
  NOM: "nominative · مرفوع",
  ACC: "accusative · منصوب",
  GEN: "genitive · مجرور",
};

const MOOD: Record<string, string> = {
  IND: "indicative · مرفوع",
  SUBJ: "subjunctive · منصوب",
  JUS: "jussive · مجزوم",
};

const ASPECT: Record<string, string> = {
  PERF: "perfect · ماضٍ",
  IMPF: "imperfect · مضارع",
  IMPV: "imperative · أمر",
};

/**
 * What a prefixed letter is doing. This is the distinction that repays reading
 * most: the wāw that joins two clauses and the wāw that puts one inside the
 * other as a circumstance are the same letter, and the corpus separates them.
 */
const PREFIX: Record<string, string> = {
  "Al+": "the definite article · ال",
  "bi+": "the preposition · بِ",
  "ka+": "the preposition · كَ",
  "ta+": "the oath · تَ",
  "sa+": "the future · سَ",
  "ya+": "the vocative · يا",
  "wa+": "and · وَ",
  "w:CONJ+": "the joining wāw · واو العطف",
  "w:REM+": "the resumptive wāw · واو الاستئناف",
  "w:CIRC+": "the circumstantial wāw · واو الحال",
  "w:SUP+": "the supplemental wāw",
  "w:COM+": "the wāw of accompaniment · واو المعية",
  "w:P+": "the oath wāw · واو القسم",
  "f:CONJ+": "the joining fā’ · فاء العطف",
  "f:REM+": "the resumptive fā’ · فاء الاستئناف",
  "f:RSLT+": "the fā’ of the answer · فاء الجواب",
  "f:CAUS+": "the causal fā’ · فاء السببية",
  "f:SUP+": "the supplemental fā’",
  "l:P+": "the preposition · لِ",
  "l:EMPH+": "the lām of emphasis · لام التوكيد",
  "l:PRP+": "the lām of purpose · لام التعليل",
  "l:IMPV+": "the lām of command · لام الأمر",
  "A:INTG+": "the interrogative alif · همزة الاستفهام",
};

/** The two families of governing particles the corpus marks by name. */
const FAMILY: Record<string, string> = {
  "kaAn": "of kāna and its sisters",
  "<in~": "of inna and its sisters",
  "kaAd": "of kāda and its sisters",
};

/**
 * Which part of the word a segment is. The corpus states this outright — it is
 * the first code in every segment — so it can be shown as a colour without
 * anything being worked out from the letters.
 */
export type Role = "prefix" | "stem" | "suffix";

/** What a segment turns out to be once its codes are read together. */
export interface Grammar {
  role: Role;
  /** The root, spaced as the corpus spaces it: `"ح م د"`. Empty on affixes. */
  root: string;
  /** The dictionary form. Empty where the corpus records none. */
  lemma: string;
  /** Everything else, in reading order, already in English. */
  traits: string[];
}

/**
 * A word with no prefix and no suffix is one segment, and colouring it says
 * nothing that the single row does not already say. Worth knowing before the
 * legend is drawn.
 */
export function isCompound(grammars: Grammar[]): boolean {
  return grammars.some((g) => g.role !== "stem");
}

/**
 * Turn one segment's `features_raw` into a root, a lemma and a plain-English
 * list of its grammar. `pos` is the corpus's own spelled-out part of speech,
 * used only to decide whether a bare `PERF`-style code belongs to a verb.
 */
export function readGrammar(raw: string, pos: string): Grammar {
  const atoms = (raw || "").split("|").filter(Boolean);
  const has = (a: string) => atoms.includes(a);

  const role: Role = has("PREFIX") ? "prefix" : has("SUFFIX") ? "suffix" : "stem";
  let root = "";
  let lemma = "";
  const traits: string[] = [];
  const push = (t: string | undefined) => {
    if (t && !traits.includes(t)) traits.push(t);
  };

  // A participle is a noun built off a verb, so ACT and PASS beside PCPL name
  // the participle rather than the voice of a finite verb. Read together, once.
  if (has("PCPL")) {
    push(has("PASS") ? "passive participle · اسم مفعول" : "active participle · اسم فاعل");
  }
  if (has("VN")) push("verbal noun · مصدر");

  for (const atom of atoms) {
    // Structural markers. Which part of the word this is, is shown beside the
    // segment itself, so saying it again in the trait list is noise.
    if (atom === "STEM" || atom === "PREFIX" || atom === "SUFFIX") continue;
    if (atom === "PCPL" || atom === "VN") continue;
    if ((atom === "ACT" || atom === "PASS") && has("PCPL")) continue;

    if (atom.startsWith("ROOT:")) {
      root = atom.slice(5);
      continue;
    }
    if (atom.startsWith("LEM:")) {
      lemma = atom.slice(4);
      continue;
    }
    if (atom.startsWith("POS:")) continue; // already spelled out by the corpus

    if (atom.startsWith("PRON:")) {
      const who = PERSON[atom.slice(5)];
      push(who ? `attached pronoun · ${who}` : `attached pronoun · ${atom.slice(5)}`);
      continue;
    }
    if (atom.startsWith("MOOD:")) {
      push(MOOD[atom.slice(5)] ?? atom.slice(5));
      continue;
    }
    if (atom.startsWith("SP:")) {
      push(FAMILY[atom.slice(3)] ?? atom.slice(3));
      continue;
    }

    // A prefix is written either bare (`Al+`) or with its function (`w:CIRC+`),
    // and both forms are keys in the one table.
    if (atom.endsWith("+")) {
      push(PREFIX[atom] ?? atom.replace(/\+$/, ""));
      continue;
    }

    // Verb form, which the corpus already gives in Roman numerals.
    const form = /^\((I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\)$/.exec(atom);
    if (form) {
      push(`form ${form[1]}`);
      continue;
    }

    if (PERSON[atom]) {
      push(PERSON[atom]);
      continue;
    }
    if (NUMBER[atom]) {
      push(NUMBER[atom]);
      continue;
    }
    if (CASE[atom]) {
      push(CASE[atom]);
      continue;
    }
    if (ASPECT[atom]) {
      push(ASPECT[atom]);
      continue;
    }
    if (atom === "ACT") {
      push("active · معلوم");
      continue;
    }
    if (atom === "PASS") {
      push("passive · مجهول");
      continue;
    }
    if (atom === "INDEF") {
      push("indefinite · نكرة");
      continue;
    }
    if (atom === "DET") {
      push("definite · معرفة");
      continue;
    }

    // Anything the tables do not know is shown as the corpus wrote it. The gap
    // is visible, which is the point; it is not filled in with a guess.
    push(atom);
  }

  // Nothing above needs `pos`, but a segment whose only trait would be its part
  // of speech reads better empty than repeating the label beside it.
  if (traits.length === 1 && traits[0].toLowerCase() === pos.toLowerCase()) traits.length = 0;

  return { role, root, lemma, traits };
}

/**
 * `"Hmd"` → `"ḥ-m-d"`. The corpus keys roots in Buckwalter, which is an ASCII
 * encoding rather than a reading; this is only so the key can be shown to
 * someone who does not read it. The Arabic root is what is displayed.
 */
const BUCKWALTER: Record<string, string> = {
  "'": "ʾ", "|": "ā", ">": "ʾ", "&": "ʾ", "<": "ʾ", "}": "ʾ", A: "ā",
  b: "b", p: "t", t: "t", v: "th", j: "j", H: "ḥ", x: "kh", d: "d",
  "*": "dh", r: "r", z: "z", s: "s", $: "sh", S: "ṣ", D: "ḍ", T: "ṭ",
  Z: "ẓ", E: "ʿ", g: "gh", f: "f", q: "q", k: "k", l: "l", m: "m",
  n: "n", h: "h", w: "w", Y: "ā", y: "y",
};

export function romanizeRoot(key: string): string {
  return [...key].map((c) => BUCKWALTER[c] ?? c).join("-");
}
