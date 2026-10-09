/**
 * The shape of a surah's introduction, as it is written in
 * `src/content/intros/<number>.json`.
 *
 * An introduction is made of three kinds of statement, and the shape keeps
 * them apart so the page can show each for what it is:
 *
 *   counted    ayat, words, pages, the place in the order of revelation. These
 *              are not written here at all — see `lib/quran/surahFacts.ts`.
 *   quoted     what a named scholar said, in the Arabic he said it in, taken
 *              from the copy of his work this site holds (`Evidence`). The
 *              build checks every quotation against that copy, letter for
 *              letter: see `scripts/lock-intros.mjs`.
 *   written    everything else — the telling of what was happening, the map of
 *              the surah, the gloss on a name. Written for this site, in
 *              English, from the works listed under `sources`.
 *
 * The same rule the rest of the site keeps holds here: a claim carries the
 * name of whoever made it. Where the written part says a thing is agreed, or
 * disputed, or narrated, the quoted part beside it is where that can be read.
 */

/** Where a surah came down. "Disputed" is said only where the scholars differ over the surah itself. */
export type Place = "makkah" | "madinah" | "disputed";

/**
 * Roughly when, as one of six stretches of the twenty-three years. It is a
 * reading aid and is shown as one — "the later years in Makkah" — never as a
 * date, because for most surahs no date is transmitted.
 */
export type Period =
  | "makkah-early"
  | "makkah-middle"
  | "makkah-late"
  | "madinah-early"
  | "madinah-middle"
  | "madinah-late";

/** A scholar's own words, from a work held in `public/tafsir`. */
export interface Evidence {
  /** The work, as the mirror names it: `"zad-almaseer"`, `"qurtubi"`, `"ibn-katheer"`. */
  work: string;
  /** The ayah whose passage the words stand in — 1 for what is said at the head of the surah. */
  ayah: number;
  /** The words. Locked to the mirror's own text, vocalisation and all. */
  quote: string;
  /** What the words say, in a line of English — for a reader who has no Arabic. */
  says?: string;
}

export interface IntroName {
  arabic: string;
  /** The name in Latin letters: "al-Sabʿ al-Mathānī". */
  name: string;
  meaning: string;
  /** Where the name comes from, and who used it. */
  note?: string;
}

/**
 * How a report stands. The page marks every one, and says a sentence beside
 * any that is not ṣaḥīḥ, so that a reader is never left to take a weaker
 * report for a sound one.
 *
 * - `agreed` — in al-Bukhārī or Muslim.
 * - `sahih` — outside them, and graded ṣaḥīḥ: by al-Albānī, or, where no
 *   grading of his was found, by the scholar the source names.
 * - `hasan` — graded ḥasan, on the same footing.
 * - `companion` — a Companion's own saying, not a statement of the Prophet ﷺ.
 * - `disputed` — the scholars of hadith differ over it.
 * - `reported` — related by the commentators, with no graded chain.
 *
 * There is no rank for a weak report: one known to be weak or fabricated is
 * neither given nor mentioned, and the lock script refuses it.
 */
export type Rank = "agreed" | "sahih" | "hasan" | "companion" | "disputed" | "reported";

/** A report of what a passage came down about — سبب النزول. */
export interface Occasion {
  /** The ayat it is about, first and last. Absent where it is about the whole surah. */
  ayat?: [number, number];
  title: string;
  /** The account — or, where there is a `story`, its opening paragraph. */
  text: string;
  /**
   * The rest of the account, paragraph by paragraph, where the report is long
   * enough to be told in full. It is told from the hadith the source names
   * and from nothing else: no detail is added that the narrator did not give.
   */
  story?: string[];
  /** Who reports it, and what is said of the report's strength where that is known. */
  source: string;
  rank: Rank;
  /**
   * Something a reader should know about the grading itself — that it was
   * taken from an index and not seen in the book, or that it is another
   * scholar's because none of al-Albānī's was found. Shown beside the
   * standing, under a small sign.
   */
  caveat?: string;
  /** The report as one of the works held here gives it. */
  evidence?: Evidence;
}

/** One stretch of the surah, in the map of it. */
export interface Passage {
  from: number;
  to: number;
  title: string;
  summary: string;
}

/** Where a hadith is to be found, in a form a link can be made from. */
export interface HadithRef {
  /** `bukhari`, `muslim`, `tirmidhi`, `abudawud`, `nasai`, `ibnmajah`, `ahmad`, `hakim`, … */
  book: string;
  number: string;
}

/** Something narrated about the surah: its merit, or when the Prophet ﷺ recited it. */
export interface Virtue {
  /** The report, in English. */
  text: string;
  /** The Prophet's ﷺ own words in it, where they are short enough to set. */
  arabic?: string;
  narrator?: string;
  /** Where it is recorded, as it should be printed: "Ṣaḥīḥ Muslim, 809". */
  source: string;
  refs?: HadithRef[];
  /** How it is graded, and by whom where it is not in the two Ṣaḥīḥs. */
  grade: string;
  rank: Rank;
  /** A word about the grading itself, as on an occasion. */
  caveat?: string;
  /** The report as one of the works held here gives it. */
  evidence?: Evidence;
}

export interface Intro {
  surah: number;
  /** A handful of words under the name: what a reader should know it as. */
  epithet: string;
  /** Two or three sentences that open the page. */
  lede: string;
  /** The names it is known by, the muṣḥaf's own first. */
  names: IntroName[];
  revelation: {
    place: Place;
    /** The finding in a few words: "Makkan, by agreement". */
    verdict: string;
    /** Who said what about where it came down, and which ayat are excepted. */
    detail: string;
    period: Period;
    /** One line placing it in the life of the Prophet ﷺ. */
    when: string;
    evidence: Evidence[];
    /**
     * The same finding as other works record it — al-Baghawī's heading, the
     * reports al-Suyūṭī gathers from the Companions, al-Shawkānī's summary —
     * each with its `says`. Shown as a short list under the quotations.
     */
    attested?: Evidence[];
  };
  /** What was happening when it came down. A paragraph to a string. */
  setting: string[];
  occasions: Occasion[];
  /** al-Mukhtaṣar's statement of the surah's aim, put into English. The Arabic is in `surah-aims.json`. */
  aim: string;
  themes: string[];
  /** The surah from its first ayah to its last, with nothing left out. */
  outline: Passage[];
  /** One ayah to carry away, shown in the reader's own translation. */
  keyAyah?: { ayah: number; why: string };
  virtues: Virtue[];
  /** What is widely repeated about the surah and is not established. */
  virtuesNote?: string;
  /** How it takes up from the surah before it in the muṣḥaf. */
  before?: string;
  /** How the surah after it takes up from this one. */
  after?: string;
  /** Ayat a reader will hear named. */
  notable: { ayah: number; to?: number; label: string }[];
  /** The works the written part was drawn from. */
  sources: string[];
}

/** What the reader's header shows of an introduction before it is opened. */
export interface IntroTeaser {
  epithet: string;
  lede: string;
}
