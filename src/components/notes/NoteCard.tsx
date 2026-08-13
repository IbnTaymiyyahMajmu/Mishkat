"use client";

import { useState } from "react";
import type { Note } from "@/lib/store/types";
import { noteHeadline } from "@/lib/notes";
import { formatDate } from "@/lib/text";
import { NoteBody } from "./NoteBody";
import styles from "./NoteCard.module.css";

interface Props {
  note: Note;
  surahName?: string;
  onEdit?: (note: Note) => void;
  onDelete?: (note: Note) => void;
  /** Shown on the notes page, where a note's surah is not implied by context. */
  showSurah?: boolean;
}

export function NoteCard({ note, surahName, onEdit, onDelete, showSurah }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <h3 className={styles.title}>{noteHeadline(note)}</h3>
        <div className={styles.meta}>
          {note.verseKey && <span className={styles.anchor}>{note.verseKey}</span>}
          {showSurah && surahName && <span>{surahName}</span>}
          <span>{formatDate(note.updatedAt)}</span>
        </div>
      </header>

      <NoteBody body={note.body} quotes={note.quotes} />

      {(onEdit || onDelete) && (
        <footer className={styles.actions}>
          {onEdit && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onEdit(note)}>
              Edit
            </button>
          )}
          <div style={{ flex: 1 }} />
          {onDelete &&
            (confirming ? (
              <>
                <span className={styles.confirm}>Delete this note?</span>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirming(false)}>
                  Keep
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => onDelete(note)}
                >
                  Delete
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirming(true)}>
                Delete
              </button>
            ))}
        </footer>
      )}
    </article>
  );
}
