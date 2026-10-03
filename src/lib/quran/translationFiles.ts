import { keptJson } from "./kept";

/**
 * Translations read from files, where the corpus does not carry them.
 *
 * The corpus is where a translation comes from, with one exception so far.
 * The Clear Qur'an — Dr. Mustafa Khattab's — was in it, was the translation a
 * good many readers chose, and was taken out of it at its publisher's request.
 * The owner of this site keeps a copy of the `quran-json` collection, a fork
 * of ReflectsLight's, published as plain files that any page may read: a file
 * to a surah, a folder to a language. This is the adapter for it.
 *
 * What is taken from it, and what is not. Its English is Khattab's, whole: 114
 * files, 6,236 ayat, every one numbered as the muṣḥaf numbers it, checked
 * before it was wired in. Its other folders are left where they are. Its
 * French is Hamidullah's, its Italian Piccardo's, its Dutch Siregar's, its
 * Persian Taji Kal Dari's and its Portuguese El-Hayek's — and the corpus has
 * all five, with the translators' footnotes, which these files do not have.
 *
 * What these files are not. They are the translation's sentences without its
 * notes, so a translation read from here shows no footnote marks. And they are
 * a copy somebody took, not the publisher's own: the collection's licence note
 * is one line — "The translators hold the copyright for the translated
 * content" — and that is the whole of the position. Whether this site may
 * show The Clear Qur'an is a question for its publisher, not for the fork it
 * is read from. See DATA-NEEDED.md.
 *
 * The text is read from where it is published, like the corpus, and is not
 * copied into this site.
 */

export const TRANSLATION_FILES = {
  name: "quran-json",
  href: "https://github.com/IbnTaymiyyahMajmu/quran-json",
  /** The collection this copy was forked from. */
  upstream: "ReflectsLight/quran-json",
} as const;

/** Where the files are published. One folder to a language under it. */
const BASE = (
  process.env.NEXT_PUBLIC_TRANSLATION_FILES ??
  "https://ibntaymiyyahmajmu.github.io/quran-json/share/quran-json/TheNobleQuran"
).replace(/\/+$/, "");

export interface FiledEdition {
  /**
   * How the reader's shelf knows it. The Clear Qur'an keeps the number it had
   * in the corpus, so a reader who chose it there still has it chosen.
   */
  id: number;
  folder: string;
  name: string;
  author: string;
  /** The shelf it stands on, as `translations.ts` names shelves. */
  language: string;
  iso: string;
}

export const FILED_EDITIONS: FiledEdition[] = [
  {
    id: 131,
    folder: "en",
    name: "The Clear Qur’an · Mustafa Khattab",
    author: "Dr. Mustafa Khattab",
    language: "english",
    iso: "en",
  },
];

export function filedEdition(id: number): FiledEdition | undefined {
  return FILED_EDITIONS.find((e) => e.id === id);
}

/**
 * A file is one surah: what the surah is, then a row to an ayah.
 *
 *   [ { "id": 1, "ayahs": 7, "translator": "Dr. Mustafa Khattab", … },
 *     [1, "In the Name of Allah—…"], [2, "All praise is for Allah—…"], … ]
 */
type FiledSurah = [Record<string, unknown>, ...[number, string][]];

/** A surah in one filed translation: its text by ayah number. */
export async function fetchFiledSurah(edition: FiledEdition, surah: number): Promise<Map<number, string>> {
  const rows = await keptJson<FiledSurah>(`${BASE}/${edition.folder}/${surah}.json`, `${edition.name}, surah ${surah}`);
  const ayat = new Map<number, string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (Array.isArray(row) && typeof row[0] === "number" && typeof row[1] === "string" && row[1].trim()) {
      ayat.set(row[0], row[1].trim());
    }
  }
  if (!ayat.size) throw new Error(`${edition.name} has nothing for surah ${surah}`);
  return ayat;
}

/** One ayah of it, or nothing if the file does not have it. */
export async function fetchFiledAyah(edition: FiledEdition, key: string): Promise<string> {
  const [surah, ayah] = key.split(":").map(Number);
  try {
    return (await fetchFiledSurah(edition, surah)).get(ayah) ?? "";
  } catch {
    return "";
  }
}
