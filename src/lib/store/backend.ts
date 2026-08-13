import { emptyLibrary, LIBRARY_SCHEMA_VERSION, type LibrarySnapshot } from "./types";

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

export function normalise(value: unknown): LibrarySnapshot {
  const lib = emptyLibrary();
  if (!value || typeof value !== "object") return lib;
  const v = value as Partial<LibrarySnapshot>;
  if (Array.isArray(v.bookmarks)) lib.bookmarks = v.bookmarks.filter((b) => b && b.id && b.verseKey);
  if (Array.isArray(v.notes)) lib.notes = v.notes.filter((n) => n && n.id);
  lib.updatedAt = typeof v.updatedAt === "number" ? v.updatedAt : Date.now();
  lib.schemaVersion = LIBRARY_SCHEMA_VERSION;
  return lib;
}

/**
 * Merge two libraries record by record, newest write per record wins. Unused
 * while the only backend is this device; written now because it is the piece
 * that is genuinely hard to retrofit, and it is testable without a server.
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
