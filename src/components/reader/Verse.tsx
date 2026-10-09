"use client";

import { memo, useMemo } from "react";
import type { Verse as VerseModel, Word } from "@/lib/quran/types";
import type { Rendering } from "@/lib/quran/useSurahTranslations";
import { arabicNumber } from "@/lib/text";
import { wordDomId } from "@/lib/highlight";
import { TranslationText } from "@/components/translations/TranslationText";
import { useLocale } from "@/lib/i18n";
import styles from "./Verse.module.css";

export interface VerseHandlers {
  onPlay: (key: string) => void;
  onRepeat: (key: string) => void;
  onBookmark: (verse: VerseModel) => void;
  onNote: (key: string) => void;
  onTafsir: (key: string) => void;
  onTranslations: (key: string) => void;
  onCopyArabic: (verse: VerseModel) => void;
  onCopyTranslation: (verse: VerseModel) => void;
  onShare: (key: string) => void;
}

interface Props {
  verse: VerseModel;
  /**
   * The translations set under this ayah, in the reader's order. Laid over the
   * text rather than carried in it — see `useSurahTranslations` — and the same
   * list from one render to the next unless a translation actually changed.
   */
  translations: Rendering[];
  layout: "rows" | "stacked";
  showTranslit: boolean;
  showWbw: boolean;
  /** The language the word meanings are in, so each is set as that language. */
  glossLanguage: string;
  showTranslation: boolean;
  /** The ayah loaded in the transport, whether or not it is sounding. */
  current: boolean;
  /** …and whether it is. The button says what pressing it will do. */
  playing: boolean;
  bookmarked: boolean;
  noteCount: number;
  flash: boolean;
  handlers: VerseHandlers;
}

function VerseImpl({
  verse,
  translations,
  layout,
  showTranslit,
  showWbw,
  glossLanguage,
  showTranslation,
  current,
  playing,
  bookmarked,
  noteCount,
  flash,
  handlers,
}: Props) {
  const key = verse.verse_key;
  const number = arabicNumber(verse.verse_number);
  const { t, arrows } = useLocale();

  // Worked out here, from the ayah, rather than handed in already worked out.
  // A filtered list is a new list every time it is made, so passing one in as
  // a prop made every ayah look changed on every render of the reader and
  // `memo` below never once got to say no.
  const words = useMemo(() => verse.words.filter((w) => w.char_type_name === "word"), [verse]);

  return (
    <article
      id={`ayah-${key}`}
      data-verse={key}
      className={[styles.verse, current && styles.playing, flash && styles.flash]
        .filter(Boolean)
        .join(" ")}
      aria-label={t("verse.label", { key })}
    >
      <div className={styles.head}>
        <div className={styles.disc} aria-hidden="true">
          {number}
        </div>
        <div className={styles.key}>{key}</div>
        {noteCount > 0 && (
          <span className={styles.noteBadge} title={t("verse.notesOn", { count: noteCount })}>
            {t("common.notes", { count: noteCount })}
          </span>
        )}
        {/* The rail marks where the ۩ fall, and a phone has no rail. An ayah of
            prostration says so at its own head, where it is read. */}
        {verse.sajdah_number != null && (
          <span className={styles.sajda} title={t("mark.sajda")}>
            <span aria-hidden="true">۩</span> {t("verse.sajda")}
          </span>
        )}
        <div className={styles.rule} />

        <div className={styles.actions}>
          <IconButton label={t(playing ? "verse.pause" : "verse.play")} onClick={() => handlers.onPlay(key)} active={playing}>
            {playing ? (
              <path d="M10 4H6v16h4zM18 4h-4v16h4z" fill="currentColor" stroke="none" />
            ) : (
              <path d="m6 4 14 8-14 8z" />
            )}
          </IconButton>

          <IconButton label={t("verse.repeat")} onClick={() => handlers.onRepeat(key)}>
            <>
              <path d="m17 2 4 4-4 4" />
              <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
              <path d="m7 22-4-4 4-4" />
              <path d="M21 13v1a4 4 0 0 1-4 4H3" />
            </>
          </IconButton>

          <IconButton
            label={t(bookmarked ? "verse.unbookmark" : "verse.bookmark")}
            onClick={() => handlers.onBookmark(verse)}
            active={bookmarked}
            pressed={bookmarked}
          >
            <path d="M19 21 12 16 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill={bookmarked ? "currentColor" : "none"} />
          </IconButton>

          <IconButton label={t("verse.note")} onClick={() => handlers.onNote(key)} active={noteCount > 0}>
            <>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </>
          </IconButton>

          <IconButton label={t("verse.tafsir")} onClick={() => handlers.onTafsir(key)}>
            <>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </>
          </IconButton>

          <IconButton label={t("verse.copyArabic")} onClick={() => handlers.onCopyArabic(verse)}>
            <>
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </>
          </IconButton>

          <IconButton label={t("verse.copyTranslation")} onClick={() => handlers.onCopyTranslation(verse)}>
            <>
              <path d="M14 3v4a1 1 0 0 0 1 1h4" />
              <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
              <path d="M9 13h6" />
              <path d="M9 17h4" />
            </>
          </IconButton>

          <IconButton label={t("verse.share")} onClick={() => handlers.onShare(key)}>
            <>
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
              <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
            </>
          </IconButton>
        </div>
      </div>

      {/* Each word is a column, so its transliteration and gloss sit directly
          under it. Three separate rows cannot do this: they are independent
          flex containers whose items wrap at their own widths, so the nth
          transliteration lands under whatever Arabic word happens to be nth
          across a different set of line breaks. `layout` now chooses how
          tightly the columns are packed, not whether they align. */}
      <div
        dir="rtl"
        translate="no"
        className={`${styles.words} ${layout === "stacked" ? styles.wordsSpaced : styles.wordsFlowing}`}
      >
        {words.map((w) => (
          <button
            key={w.position}
            data-w={wordDomId(key, w.position)}
            data-role="ar"
            className={styles.word}
            aria-label={wordAria(w)}
          >
            <span className={styles.arabic}>{w.text_uthmani || w.text}</span>
            {showTranslit && (
              <span dir="ltr" className={styles.translit}>
                {w.transliteration?.text || "—"}
              </span>
            )}
            {showWbw && (
              // The meaning's own direction: it may be Urdu or Persian now.
              <span dir="auto" lang={glossLanguage} className={styles.gloss}>
                {w.translation?.text || "—"}
              </span>
            )}
          </button>
        ))}
        <span className={styles.endDisc} aria-hidden="true">
          {number}
        </span>
      </div>

      {showTranslation && translations.length > 0 && (
        <div className={styles.translation}>
          {translations.map((r, i) => (
            <div key={r.id} className={styles.rendering}>
              <TranslationText
                text={r.text}
                footnotes={r.footnotes}
                lang={r.lang}
                className={styles.translationText}
              />
              <div className={styles.translationFoot}>
                <span className={styles.translator}>{t("common.translationOf", { name: r.name })}</span>
                {/* Under the last of them, the two things a reader of a
                    translation wants next: how others put it, and what it
                    means. The tafsir is also one of the icons above, but an
                    open book among eight icons is a thing to be found. */}
                {i === translations.length - 1 && (
                  <span className={styles.footLinks}>
                    <button className={styles.tafsirLink} onClick={() => handlers.onTranslations(key)}>
                      {t("verse.otherTranslations")}
                    </button>
                    <button className={styles.tafsirLink} onClick={() => handlers.onTafsir(key)}>
                      {t("common.tafsir")} <span aria-hidden="true">{arrows.next}</span>
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))}
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
