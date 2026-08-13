"use client";

import { memo } from "react";
import type { Verse as VerseModel, Word } from "@/lib/quran/types";
import { arabicNumber } from "@/lib/text";
import { wordDomId } from "@/lib/highlight";
import styles from "./Verse.module.css";

export interface VerseHandlers {
  onPlay: (key: string) => void;
  onRepeat: (key: string) => void;
  onBookmark: (verse: VerseModel) => void;
  onNote: (key: string) => void;
  onTafsir: (key: string) => void;
  onCopyArabic: (verse: VerseModel) => void;
  onCopyTranslation: (verse: VerseModel) => void;
  onShare: (key: string) => void;
}

interface Props {
  verse: VerseModel;
  words: Word[];
  translation: string;
  translator: string;
  layout: "rows" | "stacked";
  showTranslit: boolean;
  showWbw: boolean;
  showTranslation: boolean;
  playing: boolean;
  bookmarked: boolean;
  noteCount: number;
  flash: boolean;
  handlers: VerseHandlers;
}

function VerseImpl({
  verse,
  words,
  translation,
  translator,
  layout,
  showTranslit,
  showWbw,
  showTranslation,
  playing,
  bookmarked,
  noteCount,
  flash,
  handlers,
}: Props) {
  const key = verse.verse_key;
  const number = arabicNumber(verse.verse_number);

  return (
    <article
      id={`ayah-${key}`}
      data-verse={key}
      className={[styles.verse, playing && styles.playing, flash && styles.flash]
        .filter(Boolean)
        .join(" ")}
      aria-label={`Ayah ${key}`}
    >
      <div className={styles.head}>
        <div className={styles.disc} aria-hidden="true">
          {number}
        </div>
        <div className={styles.key}>{key}</div>
        {noteCount > 0 && (
          <span className={styles.noteBadge} title={`${noteCount} note${noteCount > 1 ? "s" : ""} on this ayah`}>
            {noteCount} {noteCount > 1 ? "notes" : "note"}
          </span>
        )}
        <div className={styles.rule} />

        <div className={styles.actions}>
          <IconButton label={playing ? "Pause this ayah" : "Play this ayah"} onClick={() => handlers.onPlay(key)} active={playing}>
            {playing ? (
              <path d="M10 4H6v16h4zM18 4h-4v16h4z" fill="currentColor" stroke="none" />
            ) : (
              <path d="m6 4 14 8-14 8z" />
            )}
          </IconButton>

          <IconButton label="Repeat this ayah" onClick={() => handlers.onRepeat(key)}>
            <>
              <path d="m17 2 4 4-4 4" />
              <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
              <path d="m7 22-4-4 4-4" />
              <path d="M21 13v1a4 4 0 0 1-4 4H3" />
            </>
          </IconButton>

          <IconButton
            label={bookmarked ? "Remove bookmark" : "Bookmark this ayah"}
            onClick={() => handlers.onBookmark(verse)}
            active={bookmarked}
            pressed={bookmarked}
          >
            <path d="M19 21 12 16 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill={bookmarked ? "currentColor" : "none"} />
          </IconButton>

          <IconButton label="Write a note on this ayah" onClick={() => handlers.onNote(key)} active={noteCount > 0}>
            <>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </>
          </IconButton>

          <IconButton label="Open tafsir for this ayah" onClick={() => handlers.onTafsir(key)}>
            <>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </>
          </IconButton>

          <IconButton label="Copy the Arabic" onClick={() => handlers.onCopyArabic(verse)}>
            <>
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </>
          </IconButton>

          <IconButton label="Copy the translation" onClick={() => handlers.onCopyTranslation(verse)}>
            <>
              <path d="M14 3v4a1 1 0 0 0 1 1h4" />
              <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
              <path d="M9 13h6" />
              <path d="M9 17h4" />
            </>
          </IconButton>

          <IconButton label="Copy a link to this ayah" onClick={() => handlers.onShare(key)}>
            <>
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
              <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
            </>
          </IconButton>
        </div>
      </div>

      {layout === "stacked" ? (
        <div dir="rtl" className={styles.stacked}>
          {words.map((w) => (
            <button
              key={w.position}
              data-w={wordDomId(key, w.position)}
              data-role="ar"
              className={styles.stackedWord}
              aria-label={wordAria(w)}
            >
              <span className={styles.stackedArabic}>{w.text_uthmani || w.text}</span>
              <span dir="ltr" className={styles.stackedTranslit}>
                {w.transliteration?.text || "—"}
              </span>
              <span dir="ltr" className={styles.stackedGloss}>
                {w.translation?.text || "—"}
              </span>
            </button>
          ))}
          <span className={styles.endDisc} aria-hidden="true">
            {number}
          </span>
        </div>
      ) : (
        <>
          <div dir="rtl" className={styles.arabicRow}>
            {words.map((w) => (
              <button
                key={w.position}
                data-w={wordDomId(key, w.position)}
                data-role="ar"
                className={styles.arabicWord}
                aria-label={wordAria(w)}
              >
                {w.text_uthmani || w.text}
              </button>
            ))}
            <span className={styles.endDisc} aria-hidden="true">
              {number}
            </span>
          </div>

          {showTranslit && (
            <div dir="rtl" className={styles.subRow}>
              {words.map((w) => (
                <button
                  key={w.position}
                  data-w={wordDomId(key, w.position)}
                  data-role="tr"
                  dir="ltr"
                  tabIndex={-1}
                  aria-hidden="true"
                  className={styles.translitWord}
                >
                  {w.transliteration?.text || "—"}
                </button>
              ))}
            </div>
          )}

          {showWbw && (
            <div dir="rtl" className={styles.subRow}>
              {words.map((w) => (
                <button
                  key={w.position}
                  data-w={wordDomId(key, w.position)}
                  data-role="en"
                  dir="ltr"
                  tabIndex={-1}
                  aria-hidden="true"
                  className={styles.glossWord}
                >
                  {w.translation?.text || "—"}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {showTranslation && translation && (
        <div className={styles.translation}>
          <p className={styles.translationText}>{translation}</p>
          <div className={styles.translator}>Translation of the meaning · {translator}</div>
        </div>
      )}
    </article>
  );
}

function wordAria(w: Word): string {
  const tr = w.transliteration?.text || "";
  const en = w.translation?.text || "";
  return tr && en ? `${tr} — ${en}` : tr || en || (w.text_uthmani ?? "");
}

function IconButton({
  label,
  onClick,
  active,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      className={`btn btn-icon ${styles.action} ${active ? styles.actionOn : ""}`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/**
 * An ayah re-renders only when something about *it* changed. Without this, one
 * bookmark toggle re-renders every ayah on screen, and in al-Baqarah that is
 * tens of thousands of nodes for a single star turning gold.
 */
export const Verse = memo(VerseImpl);
