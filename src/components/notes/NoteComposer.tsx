"use client";

import { useEffect, useRef, useState } from "react";
import type { Verse } from "@/lib/quran/types";
import type { Note, NoteQuote } from "@/lib/store/types";
import { insertQuote, pruneQuotes, quoteFromVerse, quotedKeys } from "@/lib/notes";
import { fetchVerse } from "@/lib/quran/api";
import { useSettings } from "@/lib/store/settings";
import { TRANSLATIONS } from "@/lib/quran/resources";
import { isValidVerseKey } from "@/lib/text";
import styles from "./NoteComposer.module.css";

export interface ComposerResult {
  title: string;
  body: string;
  quotes: NoteQuote[];
  verseKey: string | null;
}

interface Props {
  surah: number;
  /** The ayah the note is anchored to; the first thing offered as a quote. */
  anchorVerseKey: string | null;
  /** Ayat already loaded by the reader, so quoting costs no network. */
  loadedVerses: Verse[];
  editing?: Note | null;
  onSave: (result: ComposerResult) => void;
  onCancel: () => void;
}

export function NoteComposer({ surah, anchorVerseKey, loadedVerses, editing, onSave, onCancel }: Props) {
  const { settings } = useSettings();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [quotes, setQuotes] = useState<NoteQuote[]>(editing?.quotes ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState(anchorVerseKey ?? `${surah}:1`);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef(0);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    caretRef.current = el.value.length;
  }, [editing?.id]);

  const translatorFallback =
    TRANSLATIONS.find((t) => t.id === settings.translationId)?.label ?? "Translation";

  /** Add an ayah's text to the note at the caret, snapshotting it as we go. */
  const addQuote = async (verseKey: string) => {
    if (!isValidVerseKey(verseKey)) {
      setPickerError("Use a reference like 2:255.");
      return;
    }
    setPickerError(null);
    setResolving(true);
    try {
      let verse = loadedVerses.find((v) => v.verse_key === verseKey);
      if (!verse) {
        const fetched = await fetchVerse(verseKey, settings.translationId);
        if (!fetched) {
          setPickerError("That ayah could not be found.");
          return;
        }
        verse = fetched;
      }
      const quote = quoteFromVerse(verse, translatorFallback);
      const el = textareaRef.current;
      const caret = el ? el.selectionStart : caretRef.current;
      const next = insertQuote(body, caret, verseKey);
      setBody(next.body);
      setQuotes((prev) => [...prev.filter((q) => q.verseKey !== verseKey), quote]);
      setPickerOpen(false);
      requestAnimationFrame(() => {
        const t = textareaRef.current;
        if (!t) return;
        t.focus();
        t.setSelectionRange(next.caret, next.caret);
      });
    } finally {
      setResolving(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    const kept = pruneQuotes(trimmed, quotes);
    // The note is filed under the ayah it was opened from, or, failing that,
    // under the first ayah it quotes.
    const verseKey = editing?.verseKey ?? anchorVerseKey ?? quotedKeys(trimmed)[0] ?? null;
    onSave({ title: title.trim(), body: trimmed, quotes: kept, verseKey });
  };

  const alreadyQuoted = new Set(quotedKeys(body));

  return (
    <form className={styles.composer} onSubmit={submit}>
      <div className={styles.titleRow}>
        <input
          className={`input ${styles.title}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={anchorVerseKey ? `Title (optional) — note on ${anchorVerseKey}` : "Title (optional)"}
          aria-label="Note title"
        />
      </div>

      <textarea
        ref={textareaRef}
        className={`input ${styles.body}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onSelect={(e) => (caretRef.current = e.currentTarget.selectionStart)}
        onKeyDown={(e) => {
          // Ctrl/⌘+Enter saves, the way every other composer does.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
          }
        }}
        placeholder="What did you notice? Quote an ayah and write around it."
        aria-label="Note"
        rows={7}
      />

      <div className={styles.quoteBar}>
        {anchorVerseKey && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: "5px 11px" }}
            onClick={() => addQuote(anchorVerseKey)}
            disabled={resolving || alreadyQuoted.has(anchorVerseKey)}
          >
            {alreadyQuoted.has(anchorVerseKey) ? `${anchorVerseKey} quoted` : `Quote ${anchorVerseKey}`}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 12 }}
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
        >
          Quote another ayah
        </button>
      </div>

      {pickerOpen && (
        <div className={styles.picker}>
          <label className={styles.pickerLabel} htmlFor="quote-ref">
            Reference
          </label>
          <div className={styles.pickerRow}>
            <input
              id="quote-ref"
              className={`input ${styles.pickerInput}`}
              value={pickerValue}
              onChange={(e) => setPickerValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addQuote(pickerValue.trim());
                }
              }}
              placeholder="2:255"
              inputMode="numeric"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void addQuote(pickerValue.trim())}
              disabled={resolving}
            >
              {resolving ? "Fetching…" : "Insert"}
            </button>
          </div>
          {pickerError && <p className={styles.pickerError}>{pickerError}</p>}
          <p className={styles.pickerHint}>
            Any ayah in the Qur&rsquo;an, not only this surah. Its text is stored with the note, so
            the note still reads if you change translation later.
          </p>
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onCancel}>
          Cancel
        </button>
        <div style={{ flex: 1 }} />
        <span className={styles.hint}>⌘/Ctrl + ↵</span>
        <button type="submit" className="btn btn-primary" disabled={!body.trim()}>
          {editing ? "Save changes" : "Save note"}
        </button>
      </div>
    </form>
  );
}
