import {
  emptyLibrary,
  LIBRARY_SCHEMA_VERSION,
  type Bookmark,
  type LibrarySnapshot,
  type Note,
  type NoteQuote,
} from "./types";

/**
 * Where a library is kept.
 *
 * The application talks to this interface and never to localStorage directly.
 * Adding accounts later means writing a second implementation — one that talks
 * to a server, and resolves two snapshots by `updatedAt` per record — and
 * choosing it in `LibraryProvider`. No screen changes.
 */
export interface LibraryBackend {
  readonly id: string;
  load(): Promise<LibrarySnapshot>;
  save(snapshot: LibrarySnapshot): Promise<void>;
  /** Notifies when the library changed underneath us — another tab, or a sync. */
  subscribe(onChange: (snapshot: LibrarySnapshot) => void): () => void;
}

const KEY = "mishkat.library.v1";

/** The device itself: nothing leaves the browser. */
export class LocalBackend implements LibraryBackend {
  readonly id = "local";

  async load(): Promise<LibrarySnapshot> {
    return readLocal();
  }

  async save(snapshot: LibrarySnapshot): Promise<void> {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch {
      /* private mode, or quota — the session keeps working in memory */
    }
  }

  subscribe(onChange: (snapshot: LibrarySnapshot) => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) onChange(readLocal());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }
}

function readLocal(): LibrarySnapshot {
  if (typeof localStorage === "undefined") return emptyLibrary();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return migrateFromPrototype();
    return normalise(JSON.parse(raw));
  } catch {
    return emptyLibrary();
  }
}

/**
 * The design prototype stored bookmarks under `mishkat.bookmarks` as a bare
 * array. Anyone who used it keeps their bookmarks.
 */
function migrateFromPrototype(): LibrarySnapshot {
  const lib = emptyLibrary();
  try {
    const old = JSON.parse(localStorage.getItem("mishkat.bookmarks") || "[]");
    if (!Array.isArray(old)) return lib;
    lib.bookmarks = old
      .filter((b: unknown): b is Record<string, unknown> => !!b && typeof b === "object")
      .map((b) => {
        const ts = typeof b.ts === "number" ? b.ts : Date.now();
        return {
          id: `legacy-${String(b.key)}`,
          verseKey: String(b.key ?? ""),
          surah: Number(b.surah) || Number(String(b.key ?? "1").split(":")[0]) || 1,
          arabic: String(b.arabic ?? ""),
          translation: String(b.translation ?? ""),
          translator: "",
          createdAt: ts,
          updatedAt: ts,
        };
      })
      .filter((b) => b.verseKey);
    lib.updatedAt = Date.now();
  } catch {
    /* nothing to migrate */
  }
  return lib;
}

/**
 * Read a library out of whatever was stored or imported.
 *
 * Every screen trusts the shape of what comes out of here — a note's `quotes`
 * is mapped over without a second thought — so a record is either made whole
 * or left out. A file from an older build, or one edited by hand, should cost
 * the reader the rows that cannot be read and nothing else; a note with no
 * `quotes` used to take the notes page down with it.
 */
export function normalise(value: unknown): LibrarySnapshot {
  const lib = emptyLibrary();
  if (!value || typeof value !== "object") return lib;
  const v = value as { bookmarks?: unknown; notes?: unknown; updatedAt?: unknown };
  if (Array.isArray(v.bookmarks)) lib.bookmarks = v.bookmarks.flatMap(bookmark);
  if (Array.isArray(v.notes)) lib.notes = v.notes.flatMap(note);
  lib.updatedAt = typeof v.updatedAt === "number" ? v.updatedAt : Date.now();
  lib.schemaVersion = LIBRARY_SCHEMA_VERSION;
  return lib;
}

const VERSE_KEY = /^\d{1,3}:\d{1,3}$/;

const text = (x: unknown): string => (typeof x === "string" ? x : "");
const stamp = (x: unknown, fallback: number): number =>
  typeof x === "number" && Number.isFinite(x) ? x : fallback;

/** The fields every record carries, read off a row that may be missing some. */
function record(r: Record<string, unknown>) {
  const createdAt = stamp(r.createdAt, Date.now());
  const updatedAt = stamp(r.updatedAt, createdAt);
  const deletedAt = typeof r.deletedAt === "number" ? { deletedAt: r.deletedAt } : {};
  return { id: String(r.id), createdAt, updatedAt, ...deletedAt };
}

function bookmark(raw: unknown): Bookmark[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const verseKey = text(r.verseKey);
  if (!r.id || !VERSE_KEY.test(verseKey)) return [];
  return [
    {
      ...record(r),
      verseKey,
      surah: Number(verseKey.split(":")[0]),
      arabic: text(r.arabic),
      translation: text(r.translation),
      translator: text(r.translator),
    },
  ];
}

function quote(raw: unknown): NoteQuote[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const verseKey = text(r.verseKey);
  if (!VERSE_KEY.test(verseKey)) return [];
  return [
    {
      verseKey,
      arabic: text(r.arabic),
      translation: text(r.translation),
      translator: text(r.translator),
    },
  ];
}

function note(raw: unknown): Note[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  if (!r.id) return [];
  const verseKey = VERSE_KEY.test(text(r.verseKey)) ? text(r.verseKey) : null;
  // A note is filed under a surah. One that names none is filed under the
  // surah of the ayah it is anchored to, and failing that has no page to be on.
  const surah = Number(r.surah) || Number(verseKey?.split(":")[0]) || 0;
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return [];
  return [
    {
      ...record(r),
      surah,
      verseKey,
      title: text(r.title),
      body: text(r.body),
      quotes: Array.isArray(r.quotes) ? r.quotes.flatMap(quote) : [],
    },
  ];
}

/**
 * Merge two libraries record by record, newest write per record wins. This is
 * what importing a file does — an export from another device is a second copy
 * of the same library, to be reconciled rather than appended — and it is what
 * a sync backend would do with the copy on the server.
 */
export function mergeLibraries(a: LibrarySnapshot, b: LibrarySnapshot): LibrarySnapshot {
  return {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    bookmarks: mergeRows(a.bookmarks, b.bookmarks),
    notes: mergeRows(a.notes, b.notes),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

function mergeRows<T extends { id: string; updatedAt: number }>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of [...a, ...b]) {
    const seen = byId.get(row.id);
    if (!seen || row.updatedAt > seen.updatedAt) byId.set(row.id, row);
  }
  return [...byId.values()];
}
