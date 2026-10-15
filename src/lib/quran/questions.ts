import data from "@/content/questions/questions.json";
import type { MessageKey } from "../i18n/types";
import { fetchMushaf, fetchSurahTranslation } from "./api";
import { plainText } from "../text";

/**
 * Every question in the Qurʾān, who asks it and of whom.
 *
 * The list is `src/content/questions/who.txt`, a line to a question, made into
 * `questions.json` by `scripts/build-questions.mjs`, which checks it against
 * the Quranic Arabic Corpus word by word. This file reads that back and says
 * how its names are grouped; it holds no judgement of its own.
 */

/** Which word asks. */
export type Particle = "a" | "am" | "hal" | "ma" | "man" | "kayfa" | "ayna" | "mata" | "ayyana" | "anna" | "kam" | "ayy";

/** When the question is put. */
export type Scene = "" | "day" | "death";

export interface Question {
  key: string;
  surah: number;
  ayah: number;
  /** The word that asks, counted from 1 as the corpus counts. */
  word: number;
  particle: Particle;
  /** Who asks — an id from `WHO` — and of whom. Empty for a question within a sentence. */
  asker: string;
  asked: string;
  scene: Scene;
  /** The commentators differ on who is speaking. */
  disputed: boolean;
  /** A question inside a sentence — "to see which of you is best in deed" — not put to anyone. */
  within: boolean;
  /** Not tagged as a question by the corpus; added when the list was read through. */
  added: boolean;
  /** The recurring question this is one of, from 1; 0 for none. */
  refrain: number;
}

type Row = [string, number, string, string, string, string, number, number];

export const QUESTIONS: Question[] = (data.questions as Row[]).map(
  ([key, word, particle, asker, asked, scene, flags, refrain]) => {
    const [surah, ayah] = key.split(":").map(Number);
    return {
      key,
      surah,
      ayah,
      word,
      particle: particle as Particle,
      asker,
      asked,
      scene: scene as Scene,
      disputed: !!(flags & 1),
      within: !!(flags & 2),
      added: !!(flags & 4),
      refrain,
    };
  },
);

/** The recurring questions: where each is first asked, and how many times in all. */
export const REFRAINS = (data.refrains as [number, number, number, number][]).map(([surah, ayah, word, count], i) => ({
  id: i + 1,
  surah,
  ayah,
  word,
  count,
}));

export const QUESTIONS_SOURCE = data.source;

// ── who ─────────────────────────────────────────────────────────────────────

/** The families the askers are grouped into, as a reader would think of them. */
export type Family =
  | "allah"
  | "prophet"
  | "prophets"
  | "angels"
  | "believers"
  | "disbelievers"
  | "hypocrites"
  | "book"
  | "iblis"
  | "stories";

export const FAMILIES: Family[] = [
  "allah",
  "prophet",
  "prophets",
  "angels",
  "believers",
  "disbelievers",
  "hypocrites",
  "book",
  "iblis",
  "stories",
];

const FAMILY: Record<string, Family> = {
  allah: "allah",
  prophet: "prophet",
  prophets: "prophets",
  aprophet: "prophets",
  nuh: "prophets",
  hud: "prophets",
  salih: "prophets",
  ibrahim: "prophets",
  lut: "prophets",
  shuayb: "prophets",
  musa: "prophets",
  harun: "prophets",
  yusuf: "prophets",
  yaqub: "prophets",
  isa: "prophets",
  zakariyya: "prophets",
  sulayman: "prophets",
  ilyas: "prophets",
  angels: "angels",
  believers: "believers",
  paradise: "believers",
  believerman: "believers",
  yasinman: "believers",
  gardenfriend: "believers",
  cave: "believers",
  disciples: "believers",
  araf: "believers",
  disbelievers: "disbelievers",
  nation: "disbelievers",
  pharaoh: "disbelievers",
  chiefs: "disbelievers",
  fire: "disbelievers",
  followers: "disbelievers",
  leaders: "disbelievers",
  azar: "disbelievers",
  sorcerers: "disbelievers",
  man: "disbelievers",
  hypocrites: "hypocrites",
  book: "book",
  israel: "book",
  iblis: "iblis",
};

/** The family an asker belongs to. Anyone not named above is a person in the stories. */
export function familyOf(id: string): Family {
  return FAMILY[id] ?? "stories";
}

/** The prophets the Qurʾān names, whose people are "his people" when they speak. */
const PROPHETS = new Set(["nuh", "hud", "salih", "ibrahim", "lut", "shuayb", "musa", "isa", "ilyas"]);

/**
 * What an id is called. "nation" is said as the people of the prophet on the
 * other side of the question where there is one — Hūd's people asking Hūd —
 * and as "his people" without one.
 */
export function whoKey(id: string): MessageKey {
  return `who.${id}` as MessageKey;
}

export function nationOf(q: Question): string | null {
  const other = q.asker === "nation" ? q.asked : q.asker;
  return PROPHETS.has(other) ? other : null;
}

// ── the words ───────────────────────────────────────────────────────────────

export const PARTICLES: Particle[] = ["a", "hal", "am", "ma", "man", "kayfa", "anna", "ayna", "mata", "ayyana", "kam", "ayy"];

/** The word itself, as it is written when it asks. */
export const PARTICLE_ARABIC: Record<Particle, string> = {
  a: "أَ",
  am: "أَمْ",
  hal: "هَلْ",
  ma: "مَا",
  man: "مَنْ",
  kayfa: "كَيْفَ",
  ayna: "أَيْنَ",
  mata: "مَتَى",
  ayyana: "أَيَّانَ",
  anna: "أَنَّى",
  kam: "كَمْ",
  ayy: "أَيّ",
};

// ── the text ────────────────────────────────────────────────────────────────

/** A token of the Uthmānī text that is a word, not a pause mark standing alone. */
const isWord = (token: string) => /[ء-يٱ-ۓ]/.test(token);

export interface AyahText {
  /** The ayah's tokens as the corpus sends them, pause marks among them. */
  tokens: string[];
  /** For each token, its word number, or 0 for a pause mark. */
  numbers: number[];
  translation: string;
}

const surahs = new Map<string, Promise<Map<number, AyahText>>>();

/**
 * A surah's ayat, cut into words the way the corpus counts them, with the
 * reader's translation under each. Kept for the visit: the page asks for the
 * same surah for every question in it.
 */
export function loadSurahText(surah: number, translationId: number): Promise<Map<number, AyahText>> {
  const slot = `${surah}|${translationId}`;
  let asking = surahs.get(slot);
  if (!asking) {
    asking = Promise.all([
      fetchMushaf(surah),
      fetchSurahTranslation(translationId, surah).catch(() => null),
    ]).then(([verses, translation]) => {
      const out = new Map<number, AyahText>();
      for (const v of verses) {
        const tokens = v.text_uthmani.split(/\s+/).filter(Boolean);
        let n = 0;
        const numbers = tokens.map((t) => (isWord(t) ? ++n : 0));
        out.set(v.verse_number, {
          tokens,
          numbers,
          translation: plainText(translation?.ayat.get(v.verse_key)?.text),
        });
      }
      return out;
    });
    asking.catch(() => surahs.delete(slot));
    surahs.set(slot, asking);
  }
  return asking;
}

/** The pause marks, after which a question is taken to have been asked. */
const PAUSE = new Set(["ۖ", "ۗ", "ۚ", "ۛ", "ۘ", "ۙ", "ۜ"]);

/**
 * Which tokens of an ayah are the question: from the word that asks to the
 * next pause the muṣḥaf marks, or the next question, or the end of the ayah.
 */
export function questionSpan(text: AyahText, word: number, next?: number): [number, number] {
  const start = text.numbers.indexOf(word);
  if (start < 0) return [-1, -1];
  let end = text.tokens.length - 1;
  for (let i = start + 1; i < text.tokens.length; i++) {
    if (next && text.numbers[i] === next) {
      end = i - 1;
      break;
    }
    if (PAUSE.has(text.tokens[i])) {
      end = i - 1;
      break;
    }
  }
  return [start, end];
}
