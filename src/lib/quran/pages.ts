import structure from "@/content/structure.json";
import { ayahIndex, ayahKey } from "../store/reading";
import { fetchMushafPage, pageFontUrl } from "./api";
import { SURAH_NAMES } from "./surahNames";
import type { Verse } from "./types";

/**
 * The muṣḥaf as it is printed: 604 pages, fifteen lines to a page.
 *
 * The rest of the site sets the Qurʾān as text that runs to the width of the
 * screen. A printed muṣḥaf does not run: the Madīnah muṣḥaf has the same words
 * on the same line of the same page in every copy, and a reader who learned
 * from one knows an ayah by where it sits — top of a left-hand page, three
 * lines up from the foot. That is lost the moment the text reflows. This file
 * is what the page view needs to put it back: which ayat a page holds, which
 * line each word is on, and the page's own font.
 *
 * The King Fahd Complex drew the muṣḥaf a page at a time, and the fonts are
 * its drawing: one font to a page, each word a single glyph, spaced so that a
 * line set from them is exactly the printed line. The Quran Foundation serves
 * them, a file to a page, and its terms allow them to be kept; they are
 * credited where the site lists its sources.
 *
 * Where the divisions fall — each page, each quarter of a ḥizb — is already
 * held (`structure.json`), so finding the page of an ayah asks nobody.
 */

export const PAGES = 604;
export const LINES = 15;

/** Which part of a division an ayah falls in, from 1: the last part to begin at or before it. */
function partAt(starts: number[], index: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** The page an ayah is on: "2:255" → 42. */
export function pageOf(key: string): number {
  const index = ayahIndex(key);
  return index ? partAt(structure.page, index) : 1;
}

/** The first ayah of a page, as a key. */
export function pageStart(page: number): string {
  return ayahKey(structure.page[Math.min(PAGES, Math.max(1, page)) - 1]);
}

export interface Place {
  juz: number;
  /** The ḥizb, of sixty. */
  hizb: number;
  /** The quarter of that ḥizb the page opens in, 1 to 4. */
  quarter: number;
  /** The surahs with an ayah on the page, in order. */
  surahs: number[];
}

/** Where a page stands in the muṣḥaf's own divisions. */
export function placeOf(page: number): Place {
  const from = structure.page[page - 1];
  const to = (structure.page[page] ?? 6237) - 1;
  const rub = partAt(structure.rub, from);
  const first = partAt(structure.surah, from);
  const last = partAt(structure.surah, to);
  return {
    juz: partAt(structure.juz, from),
    hizb: Math.ceil(rub / 4),
    quarter: ((rub - 1) % 4) + 1,
    surahs: Array.from({ length: last - first + 1 }, (_, i) => first + i),
  };
}

/** The page each surah opens on. */
export function surahPage(surah: number): number {
  return partAt(structure.page, structure.surah[surah - 1]);
}

/** The page a quarter of a ḥizb opens on, the quarters counted 1 to 240. */
export function rubPage(rub: number): number {
  return partAt(structure.page, structure.rub[rub - 1]);
}

/** The ayah a quarter opens at, as a key. */
export function rubStart(rub: number): string {
  return ayahKey(structure.rub[rub - 1]);
}

/** Every ayah on a page, by its place among the 6,236. */
export function ayatOn(page: number): number[] {
  const from = structure.page[page - 1];
  const to = (structure.page[page] ?? 6237) - 1;
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// ── the lines ───────────────────────────────────────────────────────────────

export interface PageWord {
  /** The ayah it belongs to. */
  key: string;
  /** The glyph of the page's font that draws it. */
  glyph: string;
  /** The word as text, for when the font cannot be had, and for a screen reader. */
  text: string;
  /** The mark that closes an ayah rather than a word of it. */
  end: boolean;
}

export type PageLine =
  | { kind: "words"; words: PageWord[] }
  /** The band a surah's name is written in. */
  | { kind: "name"; surah: number }
  | { kind: "basmala" }
  | { kind: "empty" };

/**
 * A page as its lines.
 *
 * The corpus says which line each word is on and says nothing of the lines
 * that hold no word: the band with a surah's name in it, and the basmala
 * under it. They are the lines left over. A surah that opens on a page leaves
 * two before its first line — its name, then the basmala — or one, where
 * there is no basmala to write (at-Tawbah, and al-Fātiḥah, whose first ayah it
 * is). And a page can end on a name whose surah begins overleaf: the name on
 * its last line, the basmala on the first line of the next.
 */
export function pageLines(verses: Verse[], page: number): PageLine[] {
  // The first two pages are set in a frame of their own, with fewer lines.
  const count = page <= 2 ? 8 : LINES;
  const lines: PageLine[] = Array.from({ length: count }, () => ({ kind: "empty" }));
  /** For each surah that opens here, the line its first word is on. */
  const opens = new Map<number, number>();

  for (const verse of verses) {
    const [surah] = verse.verse_key.split(":").map(Number);
    for (const word of verse.words ?? []) {
      const at = word.line_number ?? 0;
      if (at < 1 || at > count) continue;
      const line = lines[at - 1];
      const row = line.kind === "words" ? line : (lines[at - 1] = { kind: "words", words: [] });
      row.words.push({
        key: verse.verse_key,
        glyph: word.code_v2 ?? "",
        text: word.text_uthmani ?? word.text ?? "",
        end: word.char_type_name === "end",
      });
      if (verse.verse_number === 1 && !opens.has(surah)) opens.set(surah, at);
    }
  }

  const free = (at: number) => at >= 1 && at <= count && lines[at - 1].kind === "empty";
  const basmala = (surah: number) => surah !== 1 && surah !== 9;

  for (const [surah, at] of opens) {
    if (basmala(surah) && free(at - 1)) {
      lines[at - 2] = { kind: "basmala" };
      if (free(at - 2)) lines[at - 3] = { kind: "name", surah };
    } else if (free(at - 1)) {
      lines[at - 2] = { kind: "name", surah };
    }
  }

  // What is still empty at the foot belongs to the surah that opens overleaf.
  const last = verses[verses.length - 1];
  if (last) {
    const [surah, ayah] = last.verse_key.split(":").map(Number);
    const next = surah + 1;
    if (ayah === SURAH_NAMES[surah - 1].ayat && next <= 114) {
      const foot = lines.map((l) => l.kind).lastIndexOf("words") + 1;
      if (foot < count) lines[foot] = { kind: "name", surah: next };
      if (foot + 1 < count && basmala(next)) lines[foot + 1] = { kind: "basmala" };
    }
  }
  return lines;
}

// ── asking for a page ───────────────────────────────────────────────────────

export interface MushafPage {
  page: number;
  lines: PageLine[];
  /** How many words it holds, the marks at the ends of ayat not counted. */
  words: number;
}

export async function loadPage(page: number): Promise<MushafPage> {
  const verses = await fetchMushafPage(page);
  const lines = pageLines(verses, page);
  let words = 0;
  for (const line of lines) if (line.kind === "words") words += line.words.filter((w) => !w.end).length;
  return { page, lines, words };
}

/** Fonts asked for already, by page and drawing: the asking is kept, so a page turned back to waits on nothing. */
const fonts = new Map<string, Promise<string>>();

/**
 * Whether this browser draws a font whose letters carry their own colours,
 * as the tajweed pages' fonts do (COLRv1). One that does not would draw
 * their letters without the colours, or not at all, so it is given the
 * plain pages.
 */
export function colourPagesDrawn(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("font-tech(color-COLRv1)");
}

/**
 * The page's own font, made ready, and the name to set its lines in.
 *
 * It rejects where the font cannot be had — offline, or a browser with no
 * font loading — and the page is then set from the words as text.
 *
 * `tajweed` asks for the page as the tajweed muṣḥaf prints it. Its letters
 * are the same glyphs at the same places, so the lines are laid out from
 * the same data; only the drawing differs.
 */
export function loadPageFont(page: number, tajweed = false): Promise<string> {
  const family = tajweed ? `mushaf-tj-p${page}` : `mushaf-p${page}`;
  const asked = fonts.get(family);
  if (asked) return asked;
  const asking =
    typeof FontFace === "undefined"
      ? Promise.reject<string>(new Error("no font loading here"))
      : new FontFace(family, `url(${pageFontUrl(page, tajweed)}) format("woff2")`, { display: "block" }).load().then((face) => {
          document.fonts.add(face);
          return family;
        });
  fonts.set(family, asking);
  // A failure is forgotten, so the page asks again the next time it is turned to.
  asking.catch(() => fonts.delete(family));
  return asking;
}
