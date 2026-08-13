"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DAILY } from "@/lib/quran/daily";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { arabicNumber, verseKeyParts } from "@/lib/text";
import { HomeSurahList } from "./HomeSurahList";
import { LampSky } from "./LampSky";
import { useDailyAyah, useDailyIndex } from "./useDailyAyah";
import styles from "./Home.module.css";

/**
 * The landing page.
 *
 * It opens on one ayah rather than on a menu. The niche behind it is lit from
 * a lamp just off the top of the screen, and the page below it is deliberately
 * a long way down: the reader is meant to sit with the ayah before the whole
 * muṣḥaf is offered to them.
 */
export function Home() {
  // Null until the browser has said what day it is. Nothing that names today's
  // ayah — the watermark, the theme, the link into the reader — is drawn before
  // then, so the prerendered page never points at an ayah that is not today's.
  const today = useDailyIndex();
  const entry = today === null ? null : DAILY[today];
  const surah = entry ? verseKeyParts(entry.key).surah : null;
  const ayah = useDailyAyah(entry?.key ?? null);

  const words = useMemo(
    () => (ayah?.arabic ? ayah.arabic.split(/\s+/).filter(Boolean) : []),
    [ayah],
  );

  return (
    <div className={`page-shell ${styles.shell}`}>
      <LampSky />

      <section className={styles.heroSection}>
        <div className={styles.hero}>
          <div aria-hidden="true" className={styles.ghost}>
            {surah === null ? "" : arabicNumber(surah)}
          </div>

          <div className={styles.heroHead}>
            <span className={styles.kicker}>Ayah of the day</span>
            <span className={styles.heroHeadGap} />
            <span className={styles.theme}>{entry?.theme ?? ""}</span>
          </div>

          {ayah ? (
            <div className={styles.daily}>
              <p lang="ar" dir="rtl" className={styles.words}>
                {words.map((word, i) => (
                  <span
                    key={i}
                    className={styles.word}
                    style={{ animationDelay: wordDelays(i, words.length) }}
                  >
                    {word}
                  </span>
                ))}
              </p>
              <p className={styles.translation}>{ayah.translation}</p>
              <div className={styles.reference}>
                {referenceLine(ayah.key, ayah.translator)}
              </div>
            </div>
          ) : (
            <div className={styles.pending}>Turning the page…</div>
          )}

          {entry && (
            <div className={styles.cta}>
              <Link href={`/read/${surah}/#${entry.key}`} className={styles.ctaLink}>
                Read it in context →
              </Link>
            </div>
          )}
        </div>
      </section>

      <div className={styles.lower}>
        {/* The ayah is meant to be read, not scrolled past. The list starts
            below the fold on purpose. */}
        <div aria-hidden="true" className={styles.gap} />

        <HomeSurahList />

        <section className={styles.editorial}>
          <h2 className={styles.editorialTitle}>
            The ayah is not a block of text. It is an entry point.
          </h2>
          <div className={styles.columns}>
            <article>
              <div className={styles.columnKicker}>Word by word</div>
              <h3 className={styles.columnTitle}>
                Arabic, transliteration and meaning, linked
              </h3>
              <p className={styles.columnText}>
                Hover a word on desktop or tap it on a phone and the three representations
                highlight together, with no layout shift. Tap again to open the full word study.
              </p>
            </article>
            <article>
              <div className={styles.columnKicker}>Tafsir</div>
              <h3 className={styles.columnTitle}>Seven works, side by side, never merged</h3>
              <p className={styles.columnText}>
                Ibn Kathīr, al-Ṭabarī, al-Qurṭubī, al-Saʿdī and others open beside the ayah. Each
                passage keeps its book, its author and a link to the source. Where two differ, the
                difference stays visible.
              </p>
            </article>
            <article>
              <div className={styles.columnKicker}>Provenance</div>
              <h3 className={styles.columnTitle}>Nothing is paraphrased into anonymity</h3>
              <p className={styles.columnText}>
                Text is the Uthmānī muṣḥaf from the Quran.com corpus. Translations carry their
                translator. Where a linguistic field is absent from the dataset, the interface says
                so rather than filling the gap.
              </p>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Each word rises in turn, and the sheen crosses them as one: the rise is
 * staggered forward from the first word, the sheen offset backwards, so the
 * whole ayah reads as a single surface catching the light rather than as a row
 * of separately animated words.
 */
function wordDelays(i: number, count: number): string {
  const step = Math.max(18, Math.min(58, Math.round(1000 / count)));
  const rise = 90 + i * step;
  const sheen = -i * Math.round(7000 / Math.max(1, count));
  return `${rise}ms, ${sheen}ms`;
}

/**
 * The surah is named from the baked-in table rather than from the live chapter
 * data: the reference sits directly under the ayah and should not appear a beat
 * after it.
 */
function referenceLine(key: string, translator: string): string {
  const { surah } = verseKeyParts(key);
  const name = SURAH_NAMES[surah - 1]?.english ?? `Surah ${surah}`;
  return translator ? `${name} ${key} · ${translator}` : `${name} ${key}`;
}
