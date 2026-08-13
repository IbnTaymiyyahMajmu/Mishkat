"use client";

import { parseNoteBody } from "@/lib/notes";
import type { NoteQuote } from "@/lib/store/types";
import { useGoToVerse } from "@/lib/useGoToVerse";
import styles from "./NoteBody.module.css";

/**
 * A note as written: the reader's own prose, with the ayat they quoted set
 * apart from it. The distinction between the Qur'an and a person's writing
 * about it is the one thing this component exists to keep.
 */
export function NoteBody({ body, quotes }: { body: string; quotes: NoteQuote[] }) {
  const segments = parseNoteBody(body, quotes);
  const goToVerse = useGoToVerse();

  if (!segments.length) {
    return <p className={styles.empty}>This note is empty.</p>;
  }

  return (
    <div className={styles.body}>
      {segments.map((segment, i) =>
        segment.kind === "text" ? (
          <p key={i} className={styles.prose}>
            {segment.text}
          </p>
        ) : (
          <figure key={i} className={styles.quote}>
            {segment.quote ? (
              <>
                <blockquote dir="rtl" className={styles.quoteArabic}>
                  {segment.quote.arabic}
                </blockquote>
                {segment.quote.translation && (
                  <p className={styles.quoteTranslation}>{segment.quote.translation}</p>
                )}
                <figcaption className={styles.quoteMeta}>
                  <button
                    type="button"
                    className={styles.quoteLink}
                    onClick={() => goToVerse(segment.verseKey)}
                  >
                    {segment.verseKey} ↗
                  </button>
                  {segment.quote.translator && <span> · {segment.quote.translator}</span>}
                </figcaption>
              </>
            ) : (
              // The marker survived but its snapshot did not — an imported note,
              // or a hand-edited body. Say so rather than dropping the citation.
              <figcaption className={styles.quoteMissing}>
                Quoted ayah {segment.verseKey} — text not stored with this note.{" "}
                <button type="button" className={styles.quoteLink} onClick={() => goToVerse(segment.verseKey)}>
                  Open it ↗
                </button>
              </figcaption>
            )}
          </figure>
        ),
      )}
    </div>
  );
}
