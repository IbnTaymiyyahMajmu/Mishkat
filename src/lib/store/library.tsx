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
import { LocalBackend, normalise, type LibraryBackend } from "./backend";
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

  useEffect(() => {
    const b = backendRef.current;
    let alive = true;
    b.load().then((s) => {
      if (!alive) return;
      setSnapshot(s);
      setReady(true);
    });
    const unsubscribe = b.subscribe((s) => alive && setSnapshot(s));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  /** Every mutation goes through here, so persistence is never forgotten. */
  const commit = useCallback((fn: (s: LibrarySnapshot) => LibrarySnapshot) => {
    setSnapshot((prev) => {
      const next = { ...fn(prev), updatedAt: Date.now() };
      void backendRef.current.save(next);
      return next;
    });
  }, []);

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
      const had = bookmarkKeys.has(input.verseKey);
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
    [bookmarkKeys, commit],
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
      let added = { bookmarks: 0, notes: 0 };
      commit((s) => {
        if (mode === "replace") {
          added = { bookmarks: incoming.bookmarks.length, notes: incoming.notes.length };
          return incoming;
        }
        const haveB = new Set(s.bookmarks.map((b) => b.id));
        const haveN = new Set(s.notes.map((n) => n.id));
        const newB = incoming.bookmarks.filter((b) => !haveB.has(b.id));
        const newN = incoming.notes.filter((n) => !haveN.has(n.id));
        added = { bookmarks: newB.length, notes: newN.length };
        return { ...s, bookmarks: [...newB, ...s.bookmarks], notes: [...newN, ...s.notes] };
      });
      return added;
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
