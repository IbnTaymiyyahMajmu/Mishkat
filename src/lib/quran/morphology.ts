import type { MessageKey, Translate } from "../i18n/types";

/**
 * Reading the corpus's grammar tags back into words.
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
 * ── in which language ─────────────────────────────────────────────────────
 *
 * The codes are said in the reader's language, through the site's messages
 * ("grammar.*"). Most terms also have an Arabic name, which is what a grammar
 * book and a teacher will both call it, and it is given beside the reader's
 * word for it: "genitive · مجرور".
 *
 * A reader of a language written in Arabic script — Pashto, Persian — learned
 * this grammar under its Arabic names to begin with. To them مجرور is not a
 * gloss on "genitive"; it is the term, and the other word is the gloss. So
 * there the Arabic name stands alone, and so does the part of speech: the
 * corpus spells that out in English ("Relative Pronoun"), and the Arabic
 * names below are the corpus's own, from its documentation of the tag set.
 */

/** How a segment's grammar is put into words for this reader. */
export interface GrammarSay {
  t: Translate;
  /** Whether a term's Arabic name stands alone rather than beside a translation. */
  arabicTerms: boolean;
  /** Parts of speech in this reader's language, by the corpus's tag, if it has them. */
  pos?: Record<string, string> | null;
}

/**
 * A term: the message that says it, and its Arabic name where it has one.
 * `mark` is for the Arabic that is not a name but the thing itself — the ال of
 * the article — which is shown beside the term in every language.
 */
type Term = { say: MessageKey; arabic?: string; mark?: string };

const PERSON_OF: Record<string, MessageKey> = {
  "1": "grammar.person.1",
  "2": "grammar.person.2",
  "3": "grammar.person.3",
};
const GENDER_OF: Record<string, MessageKey> = { M: "grammar.masculine", F: "grammar.feminine" };
const NUMBER_OF: Record<string, MessageKey> = { S: "grammar.singular", D: "grammar.dual", P: "grammar.plural" };

/**
 * Person, gender and number, in that order, as the corpus packs them: `3MS`,
 * `2D`, `FP`, `M`. Each letter is a word, and the words are said in the order
 * the letters come — which reads rightly in every language the site speaks.
 */
function agreement(code: string, t: Translate): string | null {
  const m = /^([123])?([MF])?([SDP])?$/.exec(code);
  if (!m || !code) return null;
  return [m[1] && t(PERSON_OF[m[1]]), m[2] && t(GENDER_OF[m[2]]), m[3] && t(NUMBER_OF[m[3]])]
    .filter(Boolean)
    .join(" ");
}

/**
 * Case and mood are given with the Arabic term beside the English, because the
 * Arabic is what a grammar book and a teacher will both call it.
 */
const CASE: Record<string, Term> = {
  NOM: { say: "grammar.nominative", arabic: "مرفوع" },
  ACC: { say: "grammar.accusative", arabic: "منصوب" },
  GEN: { say: "grammar.genitive", arabic: "مجرور" },
};

const MOOD: Record<string, Term> = {
  IND: { say: "grammar.indicative", arabic: "مرفوع" },
  SUBJ: { say: "grammar.subjunctive", arabic: "منصوب" },
  JUS: { say: "grammar.jussive", arabic: "مجزوم" },
};

const ASPECT: Record<string, Term> = {
  PERF: { say: "grammar.perfect", arabic: "ماضٍ" },
  IMPF: { say: "grammar.imperfect", arabic: "مضارع" },
  IMPV: { say: "grammar.imperative", arabic: "أمر" },
};

const STATE: Record<string, Term> = {
  ACT: { say: "grammar.active", arabic: "معلوم" },
  PASS: { say: "grammar.passive", arabic: "مجهول" },
  INDEF: { say: "grammar.indefinite", arabic: "نكرة" },
  DET: { say: "grammar.definite", arabic: "معرفة" },
};

/**
 * What a prefixed letter is doing. This is the distinction that repays reading
 * most: the wāw that joins two clauses and the wāw that puts one inside the
 * other as a circumstance are the same letter, and the corpus separates them.
 */
const PREFIX: Record<string, Term> = {
  "Al+": { say: "grammar.article", mark: "ال" },
  "bi+": { say: "grammar.preposition", mark: "بِ" },
  "ka+": { say: "grammar.preposition", mark: "كَ" },
  "ta+": { say: "grammar.oath", mark: "تَ" },
  "sa+": { say: "grammar.future", mark: "سَ" },
  "ya+": { say: "grammar.vocative", mark: "يا" },
  "wa+": { say: "grammar.and", mark: "وَ" },
  "w:CONJ+": { say: "grammar.waw.joining", arabic: "واو العطف" },
  "w:REM+": { say: "grammar.waw.resumptive", arabic: "واو الاستئناف" },
  "w:CIRC+": { say: "grammar.waw.circumstantial", arabic: "واو الحال" },
  "w:SUP+": { say: "grammar.waw.supplemental" },
  "w:COM+": { say: "grammar.waw.accompaniment", arabic: "واو المعية" },
  "w:P+": { say: "grammar.waw.oath", arabic: "واو القسم" },
  "f:CONJ+": { say: "grammar.fa.joining", arabic: "فاء العطف" },
  "f:REM+": { say: "grammar.fa.resumptive", arabic: "فاء الاستئناف" },
  "f:RSLT+": { say: "grammar.fa.answer", arabic: "فاء الجواب" },
  "f:CAUS+": { say: "grammar.fa.causal", arabic: "فاء السببية" },
  "f:SUP+": { say: "grammar.fa.supplemental" },
  "l:P+": { say: "grammar.preposition", mark: "لِ" },
  "l:EMPH+": { say: "grammar.lam.emphasis", arabic: "لام التوكيد" },
  "l:PRP+": { say: "grammar.lam.purpose", arabic: "لام التعليل" },
  "l:IMPV+": { say: "grammar.lam.command", arabic: "لام الأمر" },
  "A:INTG+": { say: "grammar.interrogative", arabic: "همزة الاستفهام" },
};

/** The two families of governing particles the corpus marks by name. */
const FAMILY: Record<string, Term> = {
  "kaAn": { say: "grammar.kana" },
  "<in~": { say: "grammar.inna" },
  "kaAd": { say: "grammar.kada" },
};

const PARTICIPLE: Record<"active" | "passive", Term> = {
  active: { say: "grammar.activeParticiple", arabic: "اسم فاعل" },
  passive: { say: "grammar.passiveParticiple", arabic: "اسم مفعول" },
};
const VERBAL_NOUN: Term = { say: "grammar.verbalNoun", arabic: "مصدر" };

function said(term: Term, say: GrammarSay): string {
  if (term.mark) return `${say.t(term.say)} · ${term.mark}`;
  if (!term.arabic) return say.t(term.say);
  return say.arabicTerms ? term.arabic : `${say.t(term.say)} · ${term.arabic}`;
}

/**
 * The parts of speech, by the corpus's tag, under the Arabic names the corpus
 * itself gives them. Shown to a reader of an Arabic script in place of the
 * English the corpus spells out; see the note at the head of this file.
 */
const POS_ARABIC: Record<string, string> = {
  N: "اسم",
  PN: "اسم علم",
  ADJ: "صفة",
  IMPN: "اسم فعل أمر",
  PRON: "ضمير",
  DEM: "اسم إشارة",
  REL: "اسم موصول",
  T: "ظرف زمان",
  LOC: "ظرف مكان",
  V: "فعل",
  P: "حرف جر",
  EMPH: "لام التوكيد",
  IMPV: "لام الأمر",
  PRP: "لام التعليل",
  CONJ: "حرف عطف",
  SUB: "حرف مصدري",
  ACC: "حرف نصب",
  AMD: "حرف استدراك",
  ANS: "حرف جواب",
  AVR: "حرف ردع",
  CAUS: "حرف سببية",
  CERT: "حرف تحقيق",
  CIRC: "حرف حال",
  COM: "واو المعية",
  COND: "حرف شرط",
  EQ: "حرف تسوية",
  EXH: "حرف تحضيض",
  EXL: "حرف تفصيل",
  EXP: "أداة استثناء",
  FUT: "حرف استقبال",
  INC: "حرف ابتداء",
  INT: "حرف تفسير",
  INTG: "حرف استفهام",
  NEG: "حرف نفي",
  PREV: "حرف كاف",
  PRO: "حرف نهي",
  REM: "حرف استئناف",
  RES: "أداة حصر",
  RET: "حرف إضراب",
  RSLT: "حرف واقع في جواب الشرط",
  SUP: "حرف زائد",
  SUR: "حرف فجاءة",
  VOC: "حرف نداء",
  INL: "حروف مقطعة",
  DET: "أداة تعريف",
};

/** The bare prefixes, which carry no tag of their own, and the tag each is. */
const BARE_PREFIX: Record<string, string> = {
  "Al+": "DET",
  "bi+": "P",
  "ka+": "P",
  "ta+": "P",
  "sa+": "FUT",
  "ya+": "VOC",
  "wa+": "CONJ",
};

/**
 * The corpus's tag for a segment's part of speech: `N`, `REL`, `CONJ`. A stem
 * states it (`POS:N`); a prefix carries it in its own code (`w:CONJ+`); an
 * attached pronoun is one by being one. Empty where none can be read.
 */
export function posTag(raw: string): string {
  const atoms = (raw || "").split("|");
  const stated = atoms.find((a) => a.startsWith("POS:"));
  if (stated) return stated.slice(4);
  for (const atom of atoms) {
    if (BARE_PREFIX[atom]) return BARE_PREFIX[atom];
    const prefixed = /^[A-Za-z]:([A-Z]+)\+$/.exec(atom);
    if (prefixed) return prefixed[1];
    if (atom.startsWith("PRON:")) return "PRON";
  }
  return "";
}

/**
 * A segment's part of speech, in words this reader reads: the Arabic name in
 * an Arabic script, the language's own where it has one, and otherwise what
 * the corpus itself spelled out.
 */
export function sayPos(raw: string, pos: string, say: GrammarSay): string {
  const tag = posTag(raw);
  return (say.arabicTerms ? POS_ARABIC[tag] : say.pos?.[tag]) || pos;
}

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
  /** Everything else, in reading order, in the reader's language. */
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
 * Turn one segment's `features_raw` into a root, a lemma and a plain list of
 * its grammar. `pos` is the corpus's own spelled-out part of speech, used only
 * to keep a segment from repeating its own label as its one trait.
 */
export function readGrammar(raw: string, pos: string, say: GrammarSay): Grammar {
  const atoms = (raw || "").split("|").filter(Boolean);
  const has = (a: string) => atoms.includes(a);

  const role: Role = has("PREFIX") ? "prefix" : has("SUFFIX") ? "suffix" : "stem";
  let root = "";
  let lemma = "";
  const traits: string[] = [];
  const push = (trait: string | undefined | null) => {
    if (trait && !traits.includes(trait)) traits.push(trait);
  };

  // A participle is a noun built off a verb, so ACT and PASS beside PCPL name
  // the participle rather than the voice of a finite verb. Read together, once.
  if (has("PCPL")) push(said(has("PASS") ? PARTICIPLE.passive : PARTICIPLE.active, say));
  if (has("VN")) push(said(VERBAL_NOUN, say));

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
    if (atom.startsWith("POS:")) continue; // said beside the segment already

    if (atom.startsWith("PRON:")) {
      const who = agreement(atom.slice(5), say.t);
      push(`${say.t("grammar.attachedPronoun")} · ${who ?? atom.slice(5)}`);
      continue;
    }
    if (atom.startsWith("MOOD:")) {
      const mood = MOOD[atom.slice(5)];
      push(mood ? said(mood, say) : atom.slice(5));
      continue;
    }
    if (atom.startsWith("SP:")) {
      const family = FAMILY[atom.slice(3)];
      push(family ? said(family, say) : atom.slice(3));
      continue;
    }

    // A prefix is written either bare (`Al+`) or with its function (`w:CIRC+`),
    // and both forms are keys in the one table.
    if (atom.endsWith("+")) {
      const prefix = PREFIX[atom];
      push(prefix ? said(prefix, say) : atom.replace(/\+$/, ""));
      continue;
    }

    // Verb form, which the corpus already gives in Roman numerals.
    const form = /^\((I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\)$/.exec(atom);
    if (form) {
      push(say.t("grammar.form", { n: form[1] }));
      continue;
    }

    const term = CASE[atom] ?? ASPECT[atom] ?? STATE[atom];
    if (term) {
      push(said(term, say));
      continue;
    }
    const agrees = agreement(atom, say.t);
    if (agrees) {
      push(agrees);
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
