"use client";

import type { Verse } from "@/lib/quran/types";
import { TranslationLibrary } from "@/components/translations/TranslationLibrary";
import { useT } from "@/lib/i18n";
import styles from "./Panels.module.css";

interface Props {
  verse: Verse | undefined;
  verseKey: string;
  /** How many ayat the surah has, so the panel knows where it ends. */
  ayahCount: number;
  /** Take the panel — and the text beside it — to another ayah of this surah. */
  onMove: (verseKey: string) => void;
}

/**
 * One ayah, as every translator rendered it.
 *
 * Under the Arabic the reader has the translations they chose. This is the
 * rest of them: the ayah in front of them in every translation the corpus
 * holds in a language, one under another, so that how Pickthall put it can be
 * read against how Abdel Haleem did. It is where a translation is chosen, too
 * — by its rendering of a real ayah rather than by its name — and it steps
 * through the surah with the text, as the tafsir does.
 */
export function TranslationsPanel({ verse, verseKey, ayahCount, onMove }: Props) {
  const [surah, ayahText] = verseKey.split(":");
  const ayah = Number(ayahText);
  const total = Math.max(ayahCount, ayah);
  const t = useT();

  return (
    <>
      {verse && (
        <div dir="rtl" lang="ar" translate="no" className={styles.tafsirVerse}>
          {verse.text_uthmani}
        </div>
      )}

      <div className={styles.tafsirBar}>
        <div className={styles.stepper} style={{ marginTop: 0 }}>
          <button
            className={styles.step}
            onClick={() => onMove(`${surah}:${ayah - 1}`)}
            disabled={ayah <= 1}
            aria-label={t("panel.prev", { n: ayah - 1 })}
          >
            ‹ {ayah > 1 ? ayah - 1 : ""}
          </button>
          <span className={styles.stepHere}>
            {t("common.ayahOf", { n: ayah, total })}
          </span>
          <button
            className={styles.step}
            onClick={() => onMove(`${surah}:${ayah + 1}`)}
            disabled={ayah >= total}
            aria-label={t("panel.next", { n: ayah + 1 })}
          >
            {ayah < total ? ayah + 1 : ""} ›
          </button>
        </div>
      </div>

      <TranslationLibrary verseKey={verseKey} />
    </>
  );
}
