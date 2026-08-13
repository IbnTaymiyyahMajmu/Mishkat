/**
 * The reader's own material: what they saved and what they wrote.
 *
 * Two decisions here are made for a future that does not exist yet, because
 * they are cheap now and expensive later:
 *
 *   1. Every record carries a stable `id`, a `createdAt` and an `updatedAt`.
 *      A record is never identified by its position in an array or by the ayah
 *      it points at, so two devices that edited the same library can be merged
 *      field by field rather than one overwriting the other.
 *
 *   2. Deletion writes a tombstone (`deletedAt`) instead of removing the row.
 *      Without one, a note deleted on a phone reappears the next time a laptop
 *      that never saw the deletion syncs its copy up.
 *
 * Until accounts exist, both cost a few bytes in localStorage and nothing else.
 */

export const LIBRARY_SCHEMA_VERSION = 1;

interface Record_ {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Set instead of removing the record, so a later sync can propagate it. */
  deletedAt?: number;
}

export interface Bookmark extends Record_ {
  verseKey: string;
  surah: number;
  /** Snapshotted so the bookmarks page reads without a network round trip. */
  arabic: string;
  translation: string;
  translator: string;
}

/**
 * An ayah quoted inside a note. The text is snapshotted at the moment of
 * quoting: a note should still read as it was written if the reader later
 * switches translation, and should read on a plane.
 */
export interface NoteQuote {
  verseKey: string;
  arabic: string;
  translation: string;
  translator: string;
}

export interface Note extends Record_ {
  /** Which surah the note belongs to; notes are listed under it. */
  surah: number;
  /** The ayah the note is anchored to, or null for a note about the surah. */
  verseKey: string | null;
  title: string;
  /**
   * The note as written. Quotes appear in the body as `{{2:255}}` on their own
   * line and are rendered from `quotes`, so the reader can move a quote around
   * inside their own prose rather than being stuck with it at the top.
   */
  body: string;
  quotes: NoteQuote[];
}

export interface LibrarySnapshot {
  schemaVersion: number;
  bookmarks: Bookmark[];
  notes: Note[];
  updatedAt: number;
}

export function emptyLibrary(): LibrarySnapshot {
  return { schemaVersion: LIBRARY_SCHEMA_VERSION, bookmarks: [], notes: [], updatedAt: 0 };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Records the reader should see: everything that has not been tombstoned. */
export function live<T extends Record_>(rows: T[]): T[] {
  return rows.filter((r) => !r.deletedAt);
}
