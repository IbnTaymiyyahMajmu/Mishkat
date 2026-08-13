"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useLibrary } from "@/lib/store/library";
import { useChapters } from "@/lib/store/chapters";
import { useToast } from "@/components/Toast";
import { noteMatches } from "@/lib/notes";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import type { Note } from "@/lib/store/types";
import { NoteCard } from "./NoteCard";
import { NoteComposer, type ComposerResult } from "./NoteComposer";
import styles from "./NotesPage.module.css";

export function NotesPage() {
  const { notes, ready, updateNote, deleteNote, exportJson, importJson } = useLibrary();
  const { byId } = useChapters();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const surahName = (n: number) => byId(n)?.name_simple ?? SURAH_NAMES[n - 1]?.english ?? `Surah ${n}`;

  /** Grouped by surah, and within a surah by ayah, so a page of notes reads in
   *  the order the Qur'an does rather than the order they happened to be typed. */
  const groups = useMemo(() => {
    const matching = notes.filter((n) => noteMatches(n, query));
    const bySurah = new Map<number, Note[]>();
    for (const note of matching) {
      const list = bySurah.get(note.surah) ?? [];
      list.push(note);
      bySurah.set(note.surah, list);
    }
    return [...bySurah.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([surah, list]) => ({
        surah,
        notes: list.sort((a, b) => ayahOf(a) - ayahOf(b) || b.updatedAt - a.updatedAt),
      }));
  }, [notes, query]);

  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mishkat-notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported");
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const added = importJson(await file.text(), "merge");
      toast(`Imported ${added.notes} notes and ${added.bookmarks} bookmarks`);
    } catch {
      toast("That file could not be read as a Mishkāt export.");
    } finally {
      e.target.value = "";
    }
  };

  const saveEdit = (result: ComposerResult) => {
    if (!editing) return;
    updateNote(editing.id, { title: result.title, body: result.body, quotes: result.quotes });
    setEditing(null);
    toast("Note updated");
  };

  return (
    <div className="page-shell">
      <div className={styles.body}>
        <header className={styles.head}>
          <div>
            <div className="kicker">Written</div>
            <h1 className={styles.title}>Notes</h1>
            <p className={styles.sub}>
              Kept in this browser and nowhere else. Nothing about your reading leaves the device.
            </p>
          </div>
          <div className={styles.tools}>
            <input
              className={`input ${styles.search}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your notes"
              aria-label="Search notes"
            />
            <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={download} disabled={!notes.length}>
              Export
            </button>
            <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => fileRef.current?.click()}>
              Import
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} hidden />
          </div>
        </header>

        {editing && (
          <div className={styles.editing}>
            <div className="kicker kicker-sm" style={{ marginBottom: 10 }}>
              Editing · {editing.verseKey ?? surahName(editing.surah)}
            </div>
            <NoteComposer
              surah={editing.surah}
              anchorVerseKey={editing.verseKey}
              loadedVerses={[]}
              editing={editing}
              onSave={saveEdit}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}

        {ready && notes.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyMark}>۞</div>
            <p className={styles.emptyText}>Nothing written yet.</p>
            <p className={styles.emptyHint}>
              Open a surah and press the pencil on any ayah — you can quote the ayah into the note
              and write around it.
            </p>
            <Link href="/read/1/" className="btn btn-primary">
              Open the reader
            </Link>
          </div>
        )}

        {notes.length > 0 && groups.length === 0 && (
          <p className={styles.noMatch}>No note matches “{query.trim()}”.</p>
        )}

        {groups.map((group) => (
          <section key={group.surah} className={styles.group}>
            <div className={styles.groupHead}>
              <Link href={`/read/${group.surah}/`} className={styles.groupName}>
                {group.surah}. {surahName(group.surah)}
              </Link>
              <span className={styles.groupRule} />
              <span className={styles.groupCount}>
                {group.notes.length} {group.notes.length === 1 ? "note" : "notes"}
              </span>
            </div>

            {group.notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                surahName={surahName(note.surah)}
                onEdit={setEditing}
                onDelete={(n) => {
                  deleteNote(n.id);
                  toast("Note deleted");
                }}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function ayahOf(note: Note): number {
  if (!note.verseKey) return 0;
  return Number(note.verseKey.split(":")[1]) || 0;
}
