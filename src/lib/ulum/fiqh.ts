import { book, file, ORIGIN } from "./books";

/**
 * The places the Ḥanafī and Ḥanbalī jurists quote an ayah.
 *
 * Their great books go by the chapters of fiqh, so they have no passage "on" an
 * ayah to read the way the other books of rulings do. `scripts/build-fiqh.mjs`
 * turned them round: every quotation the edition marks with its reference, kept
 * where its words stand in that ayah, under the ayah. Each place names the
 * printed volume and page, and its page on Shamela, where it can be checked.
 */

/** The book of each row, by its first number. Set by `scripts/build-fiqh.mjs`. */
const WORKS = ["almughni", "almubdi", "almabsut", "badai-sanai"];
/** Sections to a file. Set by `scripts/build-fiqh.mjs`. */
const BUCKET = 16;

type Stored = [
  work: number,
  section: number,
  paragraphs: number,
  vol: number,
  page: number,
  shamela: number,
  reference: string,
  kitab: string,
  head: string,
  text: string,
];

export interface FiqhPlace {
  /** The book. */
  id: string;
  /** Which of the book's kept sections it is in. */
  section: number;
  /** How many paragraphs that section has. */
  paragraphs: number;
  vol: number;
  page: number;
  /** Its page on Shamela. */
  shamela: number;
  /** The reference as the edition writes it, «البقرة: 282». */
  reference: string;
  /** The book of fiqh it stands in, «كتاب البيوع». */
  kitab: string;
  /** The heading of its section, as the edition gives it. */
  head: string;
  /** The paragraph the quotation is in. */
  text: string;
}

/** Every place the books quote this ayah, each book in its own order. */
export async function fiqhPlaces(surah: number, ayah: number): Promise<FiqhPlace[]> {
  const { ayat } = await file<{ ayat: { [ayah: string]: Stored[] } }>(`${ORIGIN.fiqh}/places/${surah}.json`);
  return (ayat[ayah] ?? []).map(([work, section, paragraphs, vol, page, shamela, reference, kitab, head, text]) => ({
    id: WORKS[work],
    section,
    paragraphs,
    vol,
    page,
    shamela,
    reference,
    kitab,
    head,
    text,
  }));
}

/** A section whole, in its paragraphs. */
export async function fiqhSection(id: string, section: number): Promise<string[]> {
  const { sections } = await file<{ sections: { [n: string]: string[] } }>(
    `${ORIGIN.fiqh}/${id}/${Math.floor(section / BUCKET)}.json`,
  );
  return sections[section] ?? [];
}

/** The page on Shamela, where a place can be checked. */
export function shamelaUrl(id: string, page: number): string {
  return `https://shamela.ws/book/${book(id)?.shamela}/${page}`;
}
