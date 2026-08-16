/**
 * The canonical shapes the application reads. They mirror the Quran.com v4
 * corpus, which is the source the MVP is connected to, but nothing above this
 * file names that API: a later migration to a local corpus or an own backend
 * replaces `api.ts` and leaves these types — and every component — alone.
 *
 * The ayah and the word are the canonical units. Translation, transliteration,
 * word gloss, audio timing and tafsir all hang off `verse_key` (`"2:255"`) and
 * word `position`, never off page position or rendered text.
 */

export interface Chapter {
  id: number;
  revelation_place: "makkah" | "madinah";
  revelation_order: number;
  bismillah_pre: boolean;
  name_simple: string;
  name_complex: string;
  name_arabic: string;
  verses_count: number;
  pages: [number, number];
  translated_name: { language_name: string; name: string };
}

export interface Word {
  id: number;
  position: number;
  /** `"word"` for words; the ayah-end glyph comes through as `"end"`. */
  char_type_name: string;
  text_uthmani?: string;
  text?: string;
  location?: string;
  audio_url?: string | null;
  translation?: { text: string; language_name: string };
  transliteration?: { text: string | null; language_name: string };
}

export interface VerseTranslation {
  id?: number;
  resource_id?: number;
  resource_name?: string;
  text: string;
}

/**
 * A word timing from the recitation: `[wordIndex, wordPosition, startMs, endMs]`.
 * Present only for reciters the corpus has timed.
 */
export type AudioSegment = [number, number, number, number];

export interface VerseAudio {
  url: string;
  segments?: AudioSegment[];
}

export interface Verse {
  id: number;
  verse_number: number;
  verse_key: string;
  juz_number: number;
  hizb_number: number;
  /** The muṣḥaf's own paragraph. Its last ayah is a resting place. */
  ruku_number: number;
  page_number: number;
  /** Set — to the ordinal of the prostration — only on the ayah carrying ۩. */
  sajdah_number: number | null;
  text_uthmani: string;
  words: Word[];
  translations?: VerseTranslation[];
  audio?: VerseAudio;
}

export interface TranslationResource {
  id: number;
  /** Full name as it should be printed under a translation. */
  label: string;
  /** Short form for tight spaces. */
  short: string;
}

export interface TafsirResource {
  id: number;
  name: string;
  author: string;
  lang: "en" | "ar";
}

export interface Reciter {
  id: number;
  label: string;
  /** Whether the corpus carries word timings for this reciter. */
  timed: boolean;
}

export interface TafsirPassage {
  paras: Para[];
  failed?: boolean;
}

export interface Para {
  text: string;
  heading: boolean;
  rtl: boolean;
}

/**
 * A word is not always one thing. `وَبِٱلْحَقِّ` is a conjunction, a preposition,
 * the article and a noun, and the corpus tags each of those separately — so the
 * breakdown of a word is a list of segments rather than a single verdict, and
 * only one of them, the stem, carries a root.
 */
export interface Segment {
  /** The letters of this segment alone, vocalised. */
  form: string;
  /** Part of speech as the corpus spells it: `"Noun"`, `"Relative Pronoun"`. */
  pos: string;
  /** `"حمد"`, and the same spaced as the corpus writes it. Empty on affixes. */
  root: string;
  rootSpaced: string;
  /** How the lexicons are addressed for this root: `"Hmd"`. */
  rootKey: string;
  /** The dictionary form the segment inflects from. */
  lemma: string;
  /** The grammar, still in the corpus's own codes. `morphology.ts` reads it. */
  raw: string;
}

export interface WordSegments {
  position: number;
  segments: Segment[];
}

/** One lexicographer's entry for one root, as a heading with a summary. */
export interface LexiconEntry {
  id: number;
  /** `"Lisān al-ʿArab"` and `"لسان العرب"`. */
  name: string;
  nameArabic: string;
  author: string;
  /** The year the author died, CE. The list is read in this order. */
  died: number | null;
  /** Whether the work is a lexicon of the Qur'an rather than of the language. */
  quranic: boolean;
  /** The entry summarised. The text it summarises arrives separately. */
  summary: string;
}

/** The same entry in full, fetched only when a reader opens it. */
export interface LexiconText {
  /** The entry as its author set it down. */
  arabic: string;
  /** A translation of that Arabic — not a rendering of the summary. */
  english: string;
  /** Where the entry can be read outside this site, and where it is scanned. */
  sourceUrl: string;
  scanUrl: string;
}

/**
 * A word in a sister Semitic language grown from the same ancestral root.
 * Comparative philology rather than Arabic lexicography, and shown as such.
 */
export interface Cognate {
  word: string;
  language: string;
  family: string;
  meaning: string;
  /** When the language is attested, in years CE; negative is BCE. */
  from: number | null;
  to: number | null;
}

export interface RootProfile {
  root: string;
  rootSpaced: string;
  key: string;
  /** `"ḥ-m-d"`, for a reader who does not read the Arabic yet. */
  romanized: string;
  occurrences: number;
  lemmas: string[];
  cognates: Cognate[];
}

export interface SearchResult {
  key: string;
  arabic: string;
  snippet: string;
  kind: "Reference" | "Qur'an text" | "Translation";
}
