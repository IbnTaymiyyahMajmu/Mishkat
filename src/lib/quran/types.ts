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

export interface SearchResult {
  key: string;
  arabic: string;
  snippet: string;
  kind: "Reference" | "Qur'an text" | "Translation";
}
