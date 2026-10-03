import { fetchTafsir } from "./api";
import {
  TAFSIR_APP,
  TAFSIR_APP_WORKS,
  fetchTafsirApp,
  tafsirAppAuthor,
  tafsirAppMirrored,
  tafsirAppReadable,
  tafsirAppUrl,
  type TafsirAppWork,
} from "./tafsirApp";
import { TAFSIR_CDN, fetchCdnTafsir } from "./tafsirCdn";
import type { Para } from "./types";

/**
 * The tafsir library, as the reader meets it.
 *
 * The works come from three places and are fetched in three ways — the
 * Quran.com corpus as the reader asks, this site's own copy of tafsir.app's
 * Arabic library, and two short English editions from the Tafsir API — and
 * none of that is the reader's concern. To them it is one library: a work has
 * a name, an author, a language, and a line saying what it is for, and it is
 * opened on an ayah. This file is where the three are made into that one.
 *
 * It is arranged as a person would ask for it. The first question is whether
 * they read Arabic, so the library divides by language before anything else;
 * and within a language, by how much they want — a paragraph, or the work at
 * length — and, for the classical works, by what kind of tafsir each is.
 */

export type TafsirLang = "en" | "ar";

export interface TafsirWork {
  /** Stable across builds: `"q:169"`, `"app:tabari"`, `"cdn:tafsir-al-jalalayn"`. */
  id: string;
  /** What it is called on a tab: its author, as readers call it. */
  short: string;
  name: string;
  /** The title in English, where the title is Arabic. */
  nameEnglish?: string;
  nameArabic?: string;
  /** "Fakhr al-Dīn al-Rāzī (d. 606 AH)". */
  credit: string;
  /** Who it is by or how it comes, in a few words, for a narrow list. */
  by: string;
  /** When it is from, in a word — "d. 310 AH" — or whose it is, where it is a committee's. */
  era: string;
  lang: TafsirLang;
  /** The kind of work it is, in two or three words. */
  kind: string;
  /** One line on what it is and what to expect of it. */
  about: string;
  /** Where the text comes from, and this ayah there. */
  origin: { name: string; href: (verseKey: string) => string };
  /** tafsir.app's id for the work, where it has more to say about it. */
  aboutId?: string;
  /**
   * The same work in the other language, where the library holds both — and a
   * word on how the two differ, where they do: a translation is not always of
   * the whole.
   */
  pair?: { id: string; note?: string };
  load: (verseKey: string) => Promise<TafsirPassage>;
}

export interface TafsirPassage {
  paras: Para[];
  /**
   * The ayat the passage is the author's treatment of, both inclusive. Often
   * one; often not, and a passage on fourteen ayat should not be read as a
   * comment on one.
   */
  from: number;
  to: number;
}

/** A run of works that belong together under one heading. */
export interface TafsirSection {
  id: string;
  title: string;
  /** The heading as tafsir.app gives it, where the division is its own. */
  titleArabic?: string;
  /**
   * What a row says under the work's name in a narrow list. In most sections
   * that is who it is by; where the section is one work of each kind, it is
   * the kind, because that is the reason the work is there.
   */
  lead: "by" | "kind";
  works: TafsirWork[];
}

export interface TafsirShelf {
  id: string;
  /** The language every work on it is written in: the first thing a reader chooses by. */
  lang: TafsirLang;
  /** That language, named. */
  label: string;
  title: string;
  note: string;
  sections: TafsirSection[];
  /** Every work on the shelf, in the order it is shown. */
  works: TafsirWork[];
}

type Described = Omit<TafsirWork, "id" | "origin" | "load">;

const ayahOf = (verseKey: string) => Number(verseKey.split(":")[1]);

/** A passage that is this ayah's alone. */
const single = (verseKey: string, paras: Para[]): TafsirPassage => {
  const ayah = ayahOf(verseKey);
  return { paras, from: ayah, to: ayah };
};

// ── from the Quran.com corpus ───────────────────────────────────────────────

const QURAN_COM = {
  name: "Quran.com",
  href: (verseKey: string) => `https://quran.com/${verseKey}/tafsirs`,
};

function corpus(id: number, work: Described): TafsirWork {
  return {
    ...work,
    id: `q:${id}`,
    origin: QURAN_COM,
    load: async (verseKey) => single(verseKey, await fetchTafsir(verseKey, id)),
  };
}

// ── from the Tafsir API ─────────────────────────────────────────────────────

function cdn(edition: string, work: Described): TafsirWork {
  return {
    ...work,
    id: `cdn:${edition}`,
    origin: { name: TAFSIR_CDN.name, href: () => TAFSIR_CDN.href },
    load: async (verseKey) => {
      const text = await fetchCdnTafsir(edition, verseKey);
      const paras = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ text: line, heading: false, rtl: false }));
      return single(verseKey, paras);
    },
  };
}

// ── from this site's copy of tafsir.app ─────────────────────────────────────

/**
 * The Arabic works that have an English version in this library, and what
 * that version is.
 *
 * There are three, and that is every one there is to have. All 123 editions of
 * the Tafsir API were opened and read, not taken by their names: its Ṭabarī,
 * Qurṭubī, Baghawī, Rāzī and the rest have English titles in its list and
 * Arabic inside. Of the works on this shelf it holds English for Ibn Kathīr,
 * abridged, and for the two short works below, and for nothing else — because
 * nothing else has been translated whole and released. The rest are read in
 * Arabic, which was the site owner's decision and is why the library is two
 * shelves and not one.
 */
const IN_ENGLISH: Record<string, { id: string; note?: string }> = {
  "ibn-katheer": { id: "q:169", note: "The English is an abridgement of this." },
  jalalayn: { id: "cdn:tafsir-al-jalalayn" },
  mukhtasar: { id: "cdn:en-tafsir-al-mukhtasar" },
};

function classical(w: TafsirAppWork): TafsirWork {
  return {
    id: `app:${w.id}`,
    short: w.short,
    name: w.name,
    nameEnglish: w.nameEnglish,
    nameArabic: w.nameArabic,
    credit: tafsirAppAuthor(w),
    by: w.nameEnglish,
    era: w.era ?? (w.died === null ? "" : `d. ${w.died} AH`),
    lang: "ar",
    kind: w.field,
    about: w.about,
    origin: { name: TAFSIR_APP.name, href: (verseKey) => tafsirAppUrl(w.id, verseKey) },
    aboutId: tafsirAppMirrored(w.id) ? w.id : undefined,
    pair: IN_ENGLISH[w.id],
    load: (verseKey) => fetchTafsirApp(w.id, verseKey),
  };
}

const HELD = TAFSIR_APP_WORKS.filter((w) => tafsirAppReadable(w.id));
const MOTHERS = "The mother works";
const BRIEF = "Brief";

/** The way back from an English work to its Arabic, if the Arabic is held. */
const inArabic = (id: string, note?: string) =>
  HELD.some((w) => w.id === id) ? { id: `app:${id}`, note } : undefined;

// ── the shelves ─────────────────────────────────────────────────────────────

const ENGLISH: TafsirSection[] = [
  {
    id: "en-brief",
    title: "To begin with",
    lead: "by",
    works: [
      cdn("en-tafsir-al-mukhtasar", {
        short: "al-Mukhtaṣar",
        name: "al-Mukhtaṣar fī al-tafsīr",
        nameEnglish: "The Concise Commentary",
        credit: "Markaz Tafsīr · in English",
        by: "Markaz Tafsīr",
        era: "Markaz Tafsīr",
        lang: "en",
        kind: "Brief",
        about: "A plain paragraph on what the ayah says, written by a committee of scholars. The place to start.",
        pair: inArabic("mukhtasar"),
      }),
      cdn("tafsir-al-jalalayn", {
        short: "al-Jalālayn",
        name: "Tafsīr al-Jalālayn",
        nameEnglish: "The Commentary of the Two Jalāls",
        credit: "al-Maḥallī (d. 864 AH) and al-Suyūṭī (d. 911 AH) · translated by Feras Hamza",
        by: "translated by Feras Hamza",
        era: "d. 864 and 911 AH",
        lang: "en",
        kind: "Brief",
        about: "The ayah glossed phrase by phrase. The most widely taught short tafsir there is.",
        pair: inArabic("jalalayn"),
      }),
    ],
  },
  {
    id: "en-length",
    title: "At length",
    lead: "by",
    works: [
      corpus(169, {
        short: "Ibn Kathīr",
        name: "Tafsīr Ibn Kathīr (abridged)",
        nameEnglish: "Commentary on the Mighty Qurʾan, abridged",
        credit: "Ismāʿīl ibn Kathīr (d. 774 AH) · abridged, in English",
        by: "abridged and translated",
        era: "d. 774 AH",
        lang: "en",
        kind: "At length",
        about: "The Qurʾan explained by the Qurʾan, by hadith and by the early generations, abridged and translated.",
        pair: inArabic("ibn-katheer", "An abridgement. The Arabic is the whole work."),
      }),
      corpus(168, {
        short: "Maʿārif al-Qurʾān",
        name: "Maʿārif al-Qurʾān",
        nameEnglish: "Insights of the Qurʾan",
        credit: "Mufti Muhammad Shafi (d. 1976) · in English",
        by: "Mufti Muhammad Shafi",
        era: "d. 1976",
        lang: "en",
        kind: "At length",
        about: "A detailed modern commentary, first written in Urdu, with its eye on rulings and lessons.",
      }),
      corpus(817, {
        short: "Tazkirul Qurʾān",
        name: "Tazkirul Qurʾān",
        nameEnglish: "The Reminder of the Qurʾan",
        credit: "Wahiduddin Khan (d. 2021) · in English",
        by: "Wahiduddin Khan",
        era: "d. 2021",
        lang: "en",
        kind: "Reflective",
        about: "Short reflections on what each passage asks of the reader.",
      }),
    ],
  },
];

const ARABIC: TafsirSection[] = [
  {
    id: "ar-brief",
    title: "Briefly",
    lead: "by",
    works: [
      // The two that are also here in English come first, as they do on the
      // English shelf, so the same pair heads both lists.
      ...HELD.filter((w) => w.field === BRIEF).map(classical),
      corpus(16, {
        short: "al-Muyassar",
        name: "al-Tafsīr al-Muyassar",
        nameEnglish: "The Simplified Commentary",
        nameArabic: "التفسير الميسر",
        credit: "King Fahd Complex",
        by: "King Fahd Complex",
        era: "King Fahd Complex",
        lang: "ar",
        kind: "Brief",
        about: "One plain paragraph to an ayah, by a committee of scholars.",
      }),
      corpus(91, {
        short: "al-Saʿdī",
        name: "Taysīr al-Karīm al-Raḥmān",
        nameEnglish: "The Facilitation of the Generous, the Merciful",
        nameArabic: "تفسير السعدي",
        credit: "ʿAbd al-Raḥmān al-Saʿdī (d. 1376 AH)",
        by: "ʿAbd al-Raḥmān al-Saʿdī",
        era: "d. 1376 AH",
        lang: "ar",
        kind: "Brief",
        about: "A clear, short commentary on the meaning and what follows from it.",
      }),
    ],
  },
  {
    id: "ar-mothers",
    title: MOTHERS,
    titleArabic: "أمّهات",
    lead: "by",
    works: HELD.filter((w) => w.field === MOTHERS).map(classical),
  },
  {
    id: "ar-kinds",
    title: "The leading work of each kind",
    lead: "kind",
    works: HELD.filter((w) => w.field !== MOTHERS && w.field !== BRIEF).map(classical),
  },
];

const shelf = (lang: TafsirLang, label: string, note: string, sections: TafsirSection[]): TafsirShelf => {
  const kept = sections.filter((section) => section.works.length > 0);
  return {
    id: label.toLowerCase(),
    lang,
    label,
    title: `In ${label}`,
    note,
    sections: kept,
    works: kept.flatMap((section) => section.works),
  };
};

export const TAFSIR_SHELVES: TafsirShelf[] = [
  shelf("en", "English", "Two short works to begin with, and three that go further.", ENGLISH),
  shelf(
    "ar",
    "Arabic",
    "Four short works; then the classical library as its authors wrote it — the four mother works, and the leading work of each other kind of tafsir.",
    ARABIC,
  ),
].filter((s) => s.works.length > 0);

export const TAFSIR_LIBRARY: TafsirWork[] = TAFSIR_SHELVES.flatMap((s) => s.works);

const BY_ID = new Map(TAFSIR_LIBRARY.map((w) => [w.id, w]));

export function tafsirWork(id: string | null | undefined): TafsirWork | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/**
 * What a reader who has chosen nothing is given: the short explanation first,
 * so that opening tafsir on an ayah answers at once and in a paragraph, and
 * Ibn Kathīr behind it for when a paragraph is not enough.
 */
export const DEFAULT_TAFSIR_SHELF = ["cdn:en-tafsir-al-mukhtasar", "q:169"];

/**
 * Bring a stored selection up to date. Before the library was one list a
 * reader's choices were kept as two — corpus ids as numbers, tafsir.app's as
 * names — and those are carried over rather than lost. Anything that names a
 * work no longer held is dropped.
 */
export function reviveTafsirShelf(stored: {
  tafsirShelf?: unknown;
  tafsirIds?: unknown;
  tafsirAppIds?: unknown;
}): string[] {
  const wanted: string[] = Array.isArray(stored.tafsirShelf)
    ? stored.tafsirShelf.filter((id): id is string => typeof id === "string")
    : [
        ...(Array.isArray(stored.tafsirIds) ? stored.tafsirIds.map((id) => `q:${id}`) : []),
        ...(Array.isArray(stored.tafsirAppIds) ? stored.tafsirAppIds.map((id) => `app:${id}`) : []),
      ];
  const kept = [...new Set(wanted)].filter((id) => BY_ID.has(id));
  return kept.length ? kept : DEFAULT_TAFSIR_SHELF.filter((id) => BY_ID.has(id));
}
