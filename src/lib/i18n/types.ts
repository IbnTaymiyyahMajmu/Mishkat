import type { en } from "./messages/en";

/**
 * A sentence that changes with a number, written out per form. English has
 * two; a language says which of these its grammar uses, and `other` is the one
 * every language has.
 */
export interface Plural {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

/** The shape of a file of messages before anything is asked of its keys. */
export type Dictionary = Record<string, string | Plural>;

export type MessageKey = keyof typeof en;

/**
 * What every language's file has to be: each of the English keys, each said as
 * the same kind of thing — a sentence where English has a sentence, the forms
 * of a plural where English has those.
 */
export type Messages = {
  [K in MessageKey]: (typeof en)[K] extends string ? string : Plural;
};

/** What is put into a sentence as it is said. */
export type Values = Record<string, string | number>;

export type Translate = (key: MessageKey, values?: Values) => string;

/**
 * What a language says about the works of tafsir.
 *
 * The works themselves are a table in `lib/quran/tafsir.ts`, written once and
 * in English: whose each is, what it is called, what to expect of it. This is
 * that last part in another language, by the work's id. A work with no entry
 * is described in English rather than not at all.
 */
export interface TafsirWords {
  /** One line on what the work is and what to expect of it. */
  about: Record<string, string>;
  /** The kinds of tafsir, by the English name the table gives each. */
  kinds: Record<string, string>;
  /** Whose a work is, where that is a description rather than a name. */
  credits: Record<string, string>;
  /** The same in a few words, for a narrow list. */
  by: Record<string, string>;
  /**
   * What a title means, for a reader who does not read the Arabic it is in.
   * Left out by a language written in Arabic script: its readers are shown
   * the title itself.
   */
  titles: Record<string, string>;
}
