/**
 * Finding the words a book is talking about.
 *
 * The books of grammar and of the readings speak about the ayah a word or a
 * phrase at a time: «(الله) لفظ الجلالة مبتدأ مرفوع (لا) نافية للجنس…». To set
 * each of those remarks under the word it is about, the word has to be found —
 * and the books quote in the spelling of their editions while the muṣḥaf is in
 * its own: السموات against ٱلسَّمَٰوَٰتِ, يؤوده against يَـُٔودُهُۥ, يا أيها against
 * يَٰٓأَيُّهَا.
 *
 * So both are reduced to the skeleton `scripts/build-xref.mjs` compares a
 * commentator's quotations by — the consonants the two spellings agree on,
 * without vowels, long vowels, the hamza and its seats, and with a doubled
 * letter written once — and a quotation is found by its skeleton in the
 * ayah's. Same rules, so a quotation found there is found here.
 *
 * Nothing is matched by meaning or by guess. A remark whose words cannot be
 * found where the book's order says they should be is left unplaced, and the
 * page shows it in the book's own sequence without pointing at any word.
 */

const ch = (code: number) => String.fromCodePoint(code);
const span = (a: number, b: number) => `${ch(a)}-${ch(b)}`;

/** Everything the two spellings disagree on. See `scripts/build-xref.mjs`. */
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
const MARBUTA = ch(0x0629);
const TA = ch(0x062a);
const PERSIAN_KAF = ch(0x06a9);
const KAF = ch(0x0643);

/** The consonants both spellings agree on, a doubled letter written once. */
export function skeleton(text: string): string {
  const bare = text
    .replace(DROP, "")
    .replaceAll(MARBUTA, TA)
    .replaceAll(PERSIAN_KAF, KAF)
    .replace(NOT_LETTER, "");
  let out = "";
  for (const c of bare) if (c !== out[out.length - 1]) out += c;
  return out;
}

/** Arabic with its vowels and the muṣḥaf's marks taken off, letters left as they are. */
const MARKS = new RegExp(
  `[${[span(0x0610, 0x061a), span(0x064b, 0x065f), ch(0x0670), span(0x06d6, 0x06ed), ch(0x0640)].join("")}]`,
  "gu",
);
export function bare(text: string): string {
  return text.replace(MARKS, "");
}

/**
 * The letters a grammarian names when he parses a piece of a word rather than
 * the word: «(الواو) عاطفة», «(الهاء) ضمير مفعول به», «(هم) مضاف إليه». The
 * prefixes stand before the word they belong to; everything else is an ending,
 * and belongs to the word just parsed.
 */
const PREFIX_LETTER: Record<string, string> = {
  الواو: "و",
  الفاء: "ف",
  الباء: "ب",
  اللام: "ل",
  الكاف: "ك",
  السين: "س",
  الهمزة: "أ",
};
const SUFFIX_NAME = new Set([
  "الهاء",
  "الياء",
  "التاء",
  "النون",
  "الميم",
  "الألف",
  "الكاف",
  "نا",
  "ها",
  "هم",
  "هما",
  "هن",
  "كم",
  "كما",
  "كن",
  "ه",
  "ي",
  "ك",
  "ت",
  "ن",
  "تم",
  "تما",
  "تن",
  "ني",
  "وا",
  "الواو",
]);

/** A quotation's skeleton, word by word, as the ayah's is joined. */
export function quoteSkeleton(quote: string): string {
  return quote.split(/\s+/).map(skeleton).join("");
}

/** A run of words, both ends inclusive, counted from 0 across what was aligned. */
export interface Placed {
  from: number;
  to: number;
}

export interface Aligner {
  /** Find the next quotation, in the book's order. */
  next(quote: string): Placed | null;
  /** Find a quotation anywhere at or after a word, without moving on. */
  find(quote: string, from?: number): Placed | null;
  /** The word the next quotation is looked for from. */
  readonly cursor: number;
}

/**
 * An aligner over a run of words — one ayah, or the several a book takes
 * together. `next` keeps the book's order: each quotation is looked for from
 * where the last one ended, which is what keeps «(لا)» on the second word of
 * «ٱللَّهُ لَآ إِلَٰهَ» rather than on the lām of the first.
 */
export function aligner(words: string[]): Aligner {
  // One string of every word's skeleton, and for each letter the word it is
  // in. A doubled letter is written once inside a word but not across two —
  // «لَآ إِلَٰهَ» keeps both its lāms — and a quotation is reduced the same way,
  // word by word, so the two always line up.
  let joined = "";
  const owner: number[] = [];
  const startOf: number[] = [];
  words.forEach((word, i) => {
    startOf.push(joined.length);
    for (const c of skeleton(word)) {
      joined += c;
      owner.push(i);
    }
  });
  const firstLetter = words.map((w) => bare(w).replace(/^[ٱا]/, "")[0] ?? "");
  const rawFirst = words.map((w) => bare(w)[0] ?? "");

  let cursor = 0;
  let last = -1;

  const locate = (quote: string, from: number): Placed | null => {
    const sk = quoteSkeleton(quote);
    if (!sk) {
      // Nothing of it survives the skeleton — «أو», «يا», «أي». It is the
      // word the reading has reached, if there is one.
      return from < words.length ? { from, to: from } : null;
    }
    const at = joined.indexOf(sk, startOf[Math.min(from, words.length - 1)] ?? joined.length);
    if (at < 0 || from >= words.length) return null;
    return { from: owner[at], to: owner[at + sk.length - 1] };
  };

  return {
    get cursor() {
      return cursor;
    },
    find(quote, from = 0) {
      return locate(quote.trim(), from);
    },
    next(quote) {
      const q = quote.trim().replace(/[.،,:؛]+$/u, "");
      if (!q) return null;
      const prefix = PREFIX_LETTER[q];
      if (prefix && cursor < words.length && (rawFirst[cursor] === prefix || firstLetter[cursor] === prefix)) {
        // A prefix belongs to the word it stands before, which is still to be read.
        last = cursor;
        return { from: cursor, to: cursor };
      }
      if (SUFFIX_NAME.has(q) || prefix) {
        if (last >= 0) return { from: last, to: last };
        return null;
      }
      if (!quoteSkeleton(q)) {
        // «يا» and «أيّ» of يَٰٓأَيُّهَا are both on the word still being read,
        // and so is the «ها» after them: the reading does not move on yet.
        if (cursor >= words.length) return null;
        last = cursor;
        return { from: cursor, to: cursor };
      }
      const placed = locate(q, cursor);
      if (!placed) return null;
      last = placed.to;
      cursor = placed.to + 1;
      return placed;
    },
  };
}
