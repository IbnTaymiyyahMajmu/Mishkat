import fiqhWorks from "@/lib/quran/fiqhWorks.json";
import tafsirWorks from "@/lib/quran/tafsirWorks.json";
import ulumWorks from "@/lib/quran/ulumWorks.json";
import tafsirMirror from "@/content/tafsir-mirror.json";
import ulumMirror from "@/content/ulum-mirror.json";
import { TAFSIR_APP } from "@/lib/quran/tafsirApp";

/**
 * Every book the ayah study reads, on whichever of the site's shelves it stands.
 *
 * The tafsir shelf is the library the tafsir page reads (`tafsirWorks.json`).
 * The sciences shelf beside it holds what that library leaves out and an ayah
 * studied science by science needs: the grammars and the books of the
 * readings (`ulumWorks.json`, copied by `mirror-tafsir.mjs --shelf ulum`).
 * Both are Nuqayah's texts, copied with their permission, and every passage
 * shown from either is shown under its book and with the way back to it on
 * tafsir.app.
 *
 * The third shelf is not tafsir.app's: the Ḥanbalī works of fiqh chapter nine
 * reads, from OpenITI (`fiqhWorks.json`, `src/lib/ulum/fiqh.ts`). They have no
 * passage by ayah, so `passage` finds nothing in them.
 */

export type Shelf = "tafsir" | "ulum" | "fiqh";

export interface Book {
  id: string;
  shelf: Shelf;
  short: string;
  name: string;
  nameEnglish: string;
  nameArabic: string;
  shortArabic?: string;
  titleArabic?: string;
  author: string;
  authorArabic?: string;
  died: number | null;
  credit?: string;
  era?: string;
  field: string;
  fieldArabic: string;
  group: string;
  /** Its number on Shamela, for a book checked there rather than on tafsir.app. */
  shamela?: number;
}

type Record = { works?: { [id: string]: { ayat: number } } };

const HELD: { [shelf in Shelf]: { [id: string]: { ayat: number } } } = {
  tafsir: (tafsirMirror as Record).works ?? {},
  ulum: (ulumMirror as Record).works ?? {},
  fiqh: {},
};

const ALL: Book[] = [
  ...(ulumWorks as Omit<Book, "shelf">[]).map((b) => ({ ...b, shelf: "ulum" as const })),
  ...(tafsirWorks as Omit<Book, "shelf">[]).map((b) => ({ ...b, shelf: "tafsir" as const })),
  ...(fiqhWorks as Omit<Book, "shelf">[]).map((b) => ({ ...b, shelf: "fiqh" as const })),
];
const BY_ID = new Map(ALL.map((b) => [b.id, b]));

export function book(id: string): Book | undefined {
  return BY_ID.get(id);
}

/** Whether this build holds the book's text. */
export function held(id: string): boolean {
  const b = BY_ID.get(id);
  return !!b && id in HELD[b.shelf];
}

/** "al-Samīn al-Ḥalabī (d. 756 AH)" — the author, as the colophon credits him. */
export function credit(b: Book): string {
  if (b.credit) return b.credit;
  return b.died === null ? b.author : `${b.author} (d. ${b.died} AH)`;
}

/** This ayah in this book, on tafsir.app — where every passage can be checked. */
export function bookUrl(id: string, verseKey: string): string {
  const [s, a] = verseKey.split(":");
  return `${TAFSIR_APP.href}/${id}/${s}/${a}`;
}

// ── reading a passage ───────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Where a shelf is read from. The site serves them all itself; the Android app
 * carries the tafsir shelf inside it but not the others, which would take it
 * past what the store accepts, so it reads those from the site
 * (`NEXT_PUBLIC_ULUM_ORIGIN`, set by the Android build).
 */
const REMOTE = (process.env.NEXT_PUBLIC_ULUM_ORIGIN ?? "").replace(/\/*$/, "") || BASE;
export const ORIGIN: { [shelf in Shelf]: string } = {
  tafsir: `${BASE}/tafsir`,
  ulum: `${REMOTE}/ulum`,
  fiqh: `${REMOTE}/fiqh`,
};

/** The same file asked for twice in one sitting is fetched once. */
const files = new Map<string, Promise<unknown>>();
const KEPT = 64;

export function file<T>(url: string): Promise<T> {
  const asked = files.get(url);
  if (asked) return asked as Promise<T>;
  const asking = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return res.json() as Promise<T>;
  });
  files.set(url, asking);
  asking.catch(() => files.delete(url));
  if (files.size > KEPT) files.delete(files.keys().next().value as string);
  return asking;
}

type Stored = [from: number, to: number, text: string];

/** A book's passage on an ayah, as stored: the ayat it covers, and its text. */
export interface Passage {
  id: string;
  from: number;
  to: number;
  text: string;
}

/**
 * The passage of a book that takes in this ayah, or null where the book has
 * nothing on it. Throws only when the book could not be reached.
 */
export async function passage(id: string, surah: number, ayah: number): Promise<Passage | null> {
  const b = BY_ID.get(id);
  if (!b || !held(id)) return null;
  const home = ORIGIN[b.shelf];
  const index = await file<{ surahs: { [s: string]: number[] } }>(`${home}/${id}/index.json`);
  const first = (index.surahs[String(surah)] ?? []).filter((start) => start <= ayah).pop();
  if (first === undefined) return null;
  const part = await file<{ passages: Stored[] }>(`${home}/${id}/${surah}-${first}.json`);
  const found = part.passages.find(([from, to]) => from <= ayah && ayah <= to);
  return found ? { id, from: found[0], to: found[1], text: found[2] } : null;
}
