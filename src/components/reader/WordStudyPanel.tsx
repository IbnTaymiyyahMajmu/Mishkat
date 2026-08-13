"use client";

import { useEffect, useState } from "react";
import type { Verse, Word } from "@/lib/quran/types";
import { fetchOccurrences } from "@/lib/quran/api";
import { stripDiacritics } from "@/lib/text";
import { useGoToVerse } from "@/lib/useGoToVerse";
import styles from "./Panels.module.css";

interface Props {
  verse: Verse | undefined;
  word: Word | undefined;
  surahName: string;
  onOpenTafsir: () => void;
}

export function WordStudyPanel({ verse, word, surahName, onOpenTafsir }: Props) {
  const goToVerse = useGoToVerse();
  const form = word ? stripDiacritics(word.text_uthmani || word.text || "") : "";

  // Stamped with the form it belongs to, so the panel is never showing one
  // word's occurrences under another word's heading while a fetch is in flight.
  const [found, setFound] = useState<{ form: string; rows: { key: string; text: string }[] }>({
    form: "",
    rows: [],
  });
  const loading = !!form && found.form !== form;
  const occurrences = found.form === form ? found.rows : [];

  useEffect(() => {
    if (!form) return;
    let alive = true;
    fetchOccurrences(form)
      .then((rows) => alive && setFound({ form, rows }))
      .catch(() => alive && setFound({ form, rows: [] }));
    return () => {
      alive = false;
    };
  }, [form]);

  if (!verse || !word) {
    return <p className={styles.empty}>Select a word in the text to study it.</p>;
  }

  const wordCount = verse.words.filter((w) => w.char_type_name === "word").length;

  return (
    <>
      <div className={styles.wordHead}>
        <div className={styles.wordArabic}>{word.text_uthmani || word.text}</div>
        <div className={styles.wordTranslit}>{word.transliteration?.text || ""}</div>
        <div className={styles.wordGloss}>{word.translation?.text || ""}</div>
      </div>

      <dl className={styles.definitions}>
        <dt>Location</dt>
        <dd className={styles.numeric}>{word.location || `${verse.verse_key}:${word.position}`}</dd>
        <dt>Ayah</dt>
        <dd>{`${surahName} ${verse.verse_key}`}</dd>
        <dt>Position</dt>
        <dd className={styles.numeric}>{`Word ${word.position} of ${wordCount}`}</dd>
        <dt>Page</dt>
        <dd className={styles.numeric}>{verse.page_number}</dd>
        <dt>Juz</dt>
        <dd className={styles.numeric}>{verse.juz_number}</dd>
      </dl>

      {/* Saying a field is absent is a statement about the data. Inferring a
          root from a surface form would be a statement about the language, and
          this product does not make those without a source. */}
      <div className={styles.missing}>
        <div className="kicker kicker-sm" style={{ marginBottom: 6 }}>
          Root · lemma · morphology
        </div>
        <p>
          Not present in the connected dataset. These fields are reserved in the data model and
          populate when a morphological corpus is added — they are left empty rather than inferred.
        </p>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className="kicker kicker-sm">Elsewhere in the Qur&rsquo;an</div>
          {occurrences.length > 0 && <div className={styles.count}>{occurrences.length} shown</div>}
        </div>

        {loading && <p className={styles.quiet}>Searching the muṣḥaf…</p>}
        {!loading && occurrences.length === 0 && (
          <p className={styles.quiet}>No other exact matches for this form.</p>
        )}

        {occurrences.map((o) => (
          <button key={o.key} className={styles.occurrence} onClick={() => goToVerse(o.key)}>
            <span dir="rtl" className={styles.occurrenceText}>
              {o.text}
            </span>
            <span className={styles.occurrenceKey}>{o.key}</span>
          </button>
        ))}
        <p className={styles.footnote}>Exact-form matches from the corpus search index.</p>
      </section>

      <button onClick={onOpenTafsir} className="btn btn-primary btn-block" style={{ marginTop: 22 }}>
        Read tafsir for {verse.verse_key}
      </button>
    </>
  );
}
