"use client";

import { useEffect, useRef, useState } from "react";
import type { Verse } from "@/lib/quran/types";
import type { Note, NoteQuote } from "@/lib/store/types";
import { insertQuote, pruneQuotes, quoteFromVerse, quotedKeys } from "@/lib/notes";
import { fetchVerse } from "@/lib/quran/api";
import { useSettings } from "@/lib/store/settings";
import { translationName } from "@/lib/quran/translations";
import { isValidVerseKey } from "@/lib/text";
import { useT, type MessageKey } from "@/lib/i18n";
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
  const t = useT();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [quotes, setQuotes] = useState<NoteQuote[]>(editing?.quotes ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState(anchorVerseKey ?? `${surah}:1`);
  const [pickerError, setPickerError] = useState<MessageKey | null>(null);
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
    translationName(settings.translationId) || t("composer.translation");

  /** Add an ayah's text to the note at the caret, snapshotting it as we go. */
  const addQuote = async (reference: string) => {
    // Read as the search box reads a reference: 2:255, 2.255, 2-255 or 2 255.
    // A phone's keyboard does not always offer the colon.
    const parts = /^(\d{1,3})\s*[:.\-\s]\s*(\d{1,3})$/.exec(reference.trim());
    const verseKey = parts ? `${+parts[1]}:${+parts[2]}` : "";
    if (!isValidVerseKey(verseKey)) {
      setPickerError("composer.badReference");
      return;
    }
    setPickerError(null);
    setResolving(true);
    try {
      let verse = loadedVerses.find((v) => v.verse_key === verseKey);
      if (!verse) {
        const fetched = await fetchVerse(verseKey, settings.translationId);
        if (!fetched) {
          setPickerError("composer.notFound");
          return;
        }
        verse = fetched;
      }
      const quote = quoteFromVerse(verse, translatorFallback);
      const el = textareaRef.current;
      const caret = el ? el.selectionStart : caretRef.current;
      // The note as it stands now, off the page. Fetching the ayah can take a
      // moment, and whatever was typed in that moment is not in the `body`
      // this function began with — inserting into that put the quote in and
      // took the last few words out.
      const next = insertQuote(el ? el.value : body, caret, verseKey);
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
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={anchorVerseKey ? t("composer.titleOn", { key: anchorVerseKey }) : t("composer.title")}
          aria-label={t("composer.titleLabel")}
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
        placeholder={t("composer.body")}
        aria-label={t("composer.bodyLabel")}
        dir="auto"
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
            {t(alreadyQuoted.has(anchorVerseKey) ? "composer.quoted" : "composer.quote", { key: anchorVerseKey })}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 12 }}
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
        >
          {t("composer.quoteAnother")}
        </button>
      </div>

      {pickerOpen && (
        <div className={styles.picker}>
          <label className={styles.pickerLabel} htmlFor="quote-ref">
            {t("composer.reference")}
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
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void addQuote(pickerValue.trim())}
              disabled={resolving}
            >
              {resolving ? t("common.fetching") : t("composer.insert")}
            </button>
          </div>
          {pickerError && <p className={styles.pickerError}>{t(pickerError)}</p>}
          <p className={styles.pickerHint}>
            {t("composer.hint")}
          </p>
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <div style={{ flex: 1 }} />
        <span className={styles.hint}>⌘/Ctrl + ↵</span>
        <button type="submit" className="btn btn-primary" disabled={!body.trim()}>
          {t(editing ? "composer.saveChanges" : "composer.save")}
        </button>
      </div>
    </form>
  );
}
