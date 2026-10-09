"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Verse } from "@/lib/quran/types";
import type { Note } from "@/lib/store/types";
import { useLibrary } from "@/lib/store/library";
import { useToast } from "@/components/Toast";
import { NoteCard } from "@/components/notes/NoteCard";
import { NoteComposer, type ComposerResult } from "@/components/notes/NoteComposer";
import { useLocale } from "@/lib/i18n";
import styles from "./Panels.module.css";

type Scope = "ayah" | "surah";

interface Props {
  surah: number;
  surahName: string;
  verseKey: string;
  loadedVerses: Verse[];
  /** True when the panel was opened by the note button on an ayah. */
  composeOnOpen: boolean;
}

/**
 * The reader's own notebook, open beside the text.
 *
 * A note is anchored to an ayah and filed under its surah, so the same panel
 * answers both "what did I write about this ayah" and "what did I write while
 * reading this surah" without becoming two features.
 */
export function NotesPanel({ surah, surahName, verseKey, loadedVerses, composeOnOpen }: Props) {
  const { notesFor, notesInSurah, createNote, updateNote, deleteNote } = useLibrary();
  const toast = useToast();
  const { t, rich } = useLocale();

  // The panel is keyed on the ayah by its parent, so opening it from a
  // different ayah's note button remounts it: a fresh composer rather than the
  // previous ayah's half-written draft.
  const [scope, setScope] = useState<Scope>("ayah");
  const [composing, setComposing] = useState(composeOnOpen);
  const [editing, setEditing] = useState<Note | null>(null);

  const ayahNotes = notesFor(verseKey);
  const surahNotes = notesInSurah(surah);
  const shown = useMemo(() => (scope === "ayah" ? ayahNotes : surahNotes), [scope, ayahNotes, surahNotes]);

  const save = (result: ComposerResult) => {
    if (editing) {
      updateNote(editing.id, {
        title: result.title,
        body: result.body,
        quotes: result.quotes,
      });
      toast(t("toast.noteUpdated"));
    } else {
      createNote({
        surah,
        verseKey: result.verseKey ?? verseKey,
        title: result.title,
        body: result.body,
        quotes: result.quotes,
      });
      toast(t("toast.noteSaved", { key: result.verseKey ?? verseKey }));
    }
    setComposing(false);
    setEditing(null);
  };

  const remove = (note: Note) => {
    deleteNote(note.id);
    toast(t("toast.noteDeleted"));
  };

  return (
    <>
      <div className={styles.scopeRow}>
        <button
          className={`${styles.scopeBtn} ${scope === "ayah" ? styles.scopeBtnOn : ""}`}
          onClick={() => setScope("ayah")}
        >
          {t("notes.thisAyah", { count: ayahNotes.length })}
        </button>
        <button
          className={`${styles.scopeBtn} ${scope === "surah" ? styles.scopeBtnOn : ""}`}
          onClick={() => setScope("surah")}
        >
          {t("notes.allOf", { surah: surahName, count: surahNotes.length })}
        </button>
      </div>

      {composing || editing ? (
        <NoteComposer
          surah={surah}
          anchorVerseKey={editing ? editing.verseKey : verseKey}
          loadedVerses={loadedVerses}
          editing={editing}
          onSave={save}
          onCancel={() => {
            setComposing(false);
            setEditing(null);
          }}
        />
      ) : (
        <button className="btn btn-primary btn-block" onClick={() => setComposing(true)} style={{ marginTop: 0 }}>
          {t("notes.write", { key: verseKey })}
        </button>
      )}

      <div className={styles.notesList}>
        {shown.length === 0 && !composing && (
          <p className={styles.empty}>
            {scope === "ayah" ? t("notes.noneOn", { key: verseKey }) : t("notes.noneIn", { surah: surahName })}
          </p>
        )}

        {shown.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onEdit={(n) => {
              setEditing(n);
              setComposing(false);
            }}
            onDelete={remove}
          />
        ))}
      </div>

      <p className={styles.footnote}>
        {rich("notes.kept", { link: (words) => <Link href="/notes/">{words}</Link> })}
      </p>
    </>
  );
}
