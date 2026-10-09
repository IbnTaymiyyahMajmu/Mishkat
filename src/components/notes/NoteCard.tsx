"use client";

import { useState } from "react";
import type { Note } from "@/lib/store/types";
import { noteHeadline } from "@/lib/notes";
import { useLocale } from "@/lib/i18n";
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
  const { t, date } = useLocale();

  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <h3 className={styles.title}>{noteHeadline(note, t)}</h3>
        <div className={styles.meta}>
          {note.verseKey && <span className={styles.anchor}>{note.verseKey}</span>}
          {showSurah && surahName && <span>{surahName}</span>}
          <span>{date(note.updatedAt)}</span>
        </div>
      </header>

      <NoteBody body={note.body} quotes={note.quotes} />

      {(onEdit || onDelete) && (
        <footer className={styles.actions}>
          {onEdit && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onEdit(note)}>
              {t("common.edit")}
            </button>
          )}
          <div style={{ flex: 1 }} />
          {onDelete &&
            (confirming ? (
              <>
                <span className={styles.confirm}>{t("notes.deleteAsk")}</span>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirming(false)}>
                  {t("common.keep")}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => onDelete(note)}
                >
                  {t("common.delete")}
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirming(true)}>
                {t("common.delete")}
              </button>
            ))}
        </footer>
      )}
    </article>
  );
}
