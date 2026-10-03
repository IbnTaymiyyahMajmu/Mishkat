"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LocalBackend, mergeLibraries, normalise, type LibraryBackend } from "./backend";
import {
  emptyLibrary,
  live,
  newId,
  type Bookmark,
  type LibrarySnapshot,
  type Note,
  type NoteQuote,
} from "./types";

export interface NoteDraft {
  surah: number;
  verseKey: string | null;
  title?: string;
  body: string;
  quotes: NoteQuote[];
}

interface LibraryContextValue {
  ready: boolean;
  bookmarks: Bookmark[];
  notes: Note[];

  isBookmarked: (verseKey: string) => boolean;
  toggleBookmark: (b: Omit<Bookmark, "id" | "createdAt" | "updatedAt">) => boolean;
  removeBookmark: (id: string) => void;

  notesFor: (verseKey: string) => Note[];
  notesInSurah: (surah: number) => Note[];
  noteCount: (verseKey: string) => number;
  createNote: (draft: NoteDraft) => Note;
  updateNote: (id: string, patch: Partial<NoteDraft>) => void;
  deleteNote: (id: string) => void;

  exportJson: () => string;
  importJson: (text: string, mode: "merge" | "replace") => { bookmarks: number; notes: number };
  clearAll: () => void;
}

const Ctx = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({
  children,
  backend,
}: {
  children: ReactNode;
  backend?: LibraryBackend;
}) {
  const backendRef = useRef<LibraryBackend>(backend ?? new LocalBackend());
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>(emptyLibrary);
  const [ready, setReady] = useState(false);
  /**
   * The library as of this instant, which the state above is only as of the
   * last render. A mutation is worked out against this — so two in one tick
   * build on each other, a caller can be told what its own change did, and
   * saving is something a mutation does rather than a side effect buried in a
   * state updater that React is free to run twice, or later.
   */
  const latestRef = useRef<LibrarySnapshot>(snapshot);

  const adopt = useCallback((next: LibrarySnapshot) => {
    latestRef.current = next;
    setSnapshot(next);
  }, []);

  useEffect(() => {
    const b = backendRef.current;
    let alive = true;
    b.load().then((s) => {
      if (!alive) return;
      adopt(s);
      setReady(true);
    });
    const unsubscribe = b.subscribe((s) => alive && adopt(s));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [adopt]);

  /** Every mutation goes through here, so persistence is never forgotten. */
  const commit = useCallback(
    (fn: (s: LibrarySnapshot) => LibrarySnapshot) => {
      const next = { ...fn(latestRef.current), updatedAt: Date.now() };
      adopt(next);
      void backendRef.current.save(next);
    },
    [adopt],
  );

  const bookmarks = useMemo(
    () => live(snapshot.bookmarks).sort((a, b) => b.createdAt - a.createdAt),
    [snapshot.bookmarks],
  );
  const notes = useMemo(
    () => live(snapshot.notes).sort((a, b) => b.updatedAt - a.updatedAt),
    [snapshot.notes],
  );

  const bookmarkKeys = useMemo(() => new Set(bookmarks.map((b) => b.verseKey)), [bookmarks]);

  const isBookmarked = useCallback((verseKey: string) => bookmarkKeys.has(verseKey), [bookmarkKeys]);

  const toggleBookmark = useCallback<LibraryContextValue["toggleBookmark"]>(
    (input) => {
      // Asked of the library as it is now rather than as it was last rendered:
      // two presses in quick succession are a bookmark made and removed, not
      // two bookmarks on the one ayah.
      const had = live(latestRef.current.bookmarks).some((b) => b.verseKey === input.verseKey);
      const now = Date.now();
      commit((s) => {
        if (had) {
          return {
            ...s,
            bookmarks: s.bookmarks.map((b) =>
              b.verseKey === input.verseKey && !b.deletedAt
                ? { ...b, deletedAt: now, updatedAt: now }
                : b,
            ),
          };
        }
        const row: Bookmark = { ...input, id: newId(), createdAt: now, updatedAt: now };
        return { ...s, bookmarks: [row, ...s.bookmarks] };
      });
      return !had;
    },
    [commit],
  );

  const removeBookmark = useCallback(
    (id: string) => {
      const now = Date.now();
      commit((s) => ({
        ...s,
        bookmarks: s.bookmarks.map((b) => (b.id === id ? { ...b, deletedAt: now, updatedAt: now } : b)),
      }));
    },
    [commit],
  );

  const notesFor = useCallback(
    (verseKey: string) => notes.filter((n) => n.verseKey === verseKey),
    [notes],
  );

  const notesInSurah = useCallback((surah: number) => notes.filter((n) => n.surah === surah), [notes]);

  const noteCount = useCallback(
    (verseKey: string) => notes.reduce((n, x) => n + (x.verseKey === verseKey ? 1 : 0), 0),
    [notes],
  );

  const createNote = useCallback(
    (draft: NoteDraft) => {
      const now = Date.now();
      const note: Note = {
        id: newId(),
        surah: draft.surah,
        verseKey: draft.verseKey,
        title: draft.title?.trim() || "",
        body: draft.body,
        quotes: draft.quotes,
        createdAt: now,
        updatedAt: now,
      };
      commit((s) => ({ ...s, notes: [note, ...s.notes] }));
      return note;
    },
    [commit],
  );

  const updateNote = useCallback(
    (id: string, patch: Partial<NoteDraft>) => {
      const now = Date.now();
      commit((s) => ({
        ...s,
        notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now } : n)),
      }));
    },
    [commit],
  );

  const deleteNote = useCallback(
    (id: string) => {
      const now = Date.now();
      commit((s) => ({
        ...s,
        notes: s.notes.map((n) => (n.id === id ? { ...n, deletedAt: now, updatedAt: now } : n)),
      }));
    },
    [commit],
  );

  const exportJson = useCallback(
    () =>
      JSON.stringify(
        {
          app: "mishkat",
          exportedAt: new Date().toISOString(),
          ...snapshot,
        },
        null,
        2,
      ),
    [snapshot],
  );

  const importJson = useCallback<LibraryContextValue["importJson"]>(
    (text, mode) => {
      const incoming = normalise(JSON.parse(text));
      const before = latestRef.current;

      // What is reported is what the reader can now see that they could not
      // see before. An export carries tombstones — deleted rows, kept so a
      // later sync can propagate the deletion — and counting those told a
      // reader that three notes had been imported when none had appeared.
      const merging = mode === "merge";
      const seenBookmarks = new Set(merging ? live(before.bookmarks).map((b) => b.id) : []);
      const seenNotes = new Set(merging ? live(before.notes).map((n) => n.id) : []);

      let next = incoming;
      if (merging) {
        // Two devices that bookmarked the same ayah did it under two ids. One
        // ayah is one bookmark, so the copy already here is the one kept.
        const marked = new Set(live(before.bookmarks).map((b) => b.verseKey));
        const known = new Set(before.bookmarks.map((b) => b.id));
        next = mergeLibraries(before, {
          ...incoming,
          bookmarks: incoming.bookmarks.filter(
            (b) => known.has(b.id) || !!b.deletedAt || !marked.has(b.verseKey),
          ),
        });
      }

      commit(() => next);
      return {
        bookmarks: live(next.bookmarks).filter((b) => !seenBookmarks.has(b.id)).length,
        notes: live(next.notes).filter((n) => !seenNotes.has(n.id)).length,
      };
    },
    [commit],
  );

  const clearAll = useCallback(() => commit(() => emptyLibrary()), [commit]);

  const value = useMemo(
    () => ({
      ready,
      bookmarks,
      notes,
      isBookmarked,
      toggleBookmark,
      removeBookmark,
      notesFor,
      notesInSurah,
      noteCount,
      createNote,
      updateNote,
      deleteNote,
      exportJson,
      importJson,
      clearAll,
    }),
    [
      ready,
      bookmarks,
      notes,
      isBookmarked,
      toggleBookmark,
      removeBookmark,
      notesFor,
      notesInSurah,
      noteCount,
      createNote,
      updateNote,
      deleteNote,
      exportJson,
      importJson,
      clearAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return ctx;
}
