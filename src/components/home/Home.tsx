"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DAILY } from "@/lib/quran/daily";
import { useLocale } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
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
  const { t, arrows } = useLocale();
  const names = useSurahNames();

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
            <span className={styles.kicker}>{t("home.kicker")}</span>
            <span className={styles.heroHeadGap} />
            <span className={styles.theme}>{entry ? t(entry.theme) : ""}</span>
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
              <p className={styles.translation} dir="auto">
                {ayah.failed ? t("home.unreached") : ayah.translation}
              </p>
              <div className={styles.reference}>
                {/* Named from the baked-in table until the live one lands: the
                    reference sits directly under the ayah and should not
                    appear a beat after it. */}
                {[`${names.name(verseKeyParts(ayah.key).surah)} ${ayah.key}`, ayah.translator]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          ) : (
            <div className={styles.pending}>{t("home.turning")}</div>
          )}

          {entry && (
            <div className={styles.cta}>
              <Link href={`/read/${surah}/#${entry.key}`} className={styles.ctaLink}>
                {t("home.cta")} {arrows.next}
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
            {t("home.editorial.title")}
          </h2>
          <div className={styles.columns}>
            <article>
              <div className={styles.columnKicker}>{t("home.wbw.kicker")}</div>
              <h3 className={styles.columnTitle}>{t("home.wbw.title")}</h3>
              <p className={styles.columnText}>{t("home.wbw.text")}</p>
            </article>
            <article>
              <div className={styles.columnKicker}>{t("home.tafsir.kicker")}</div>
              <h3 className={styles.columnTitle}>{t("home.tafsir.title")}</h3>
              <p className={styles.columnText}>{t("home.tafsir.text")}</p>
            </article>
            <article>
              <div className={styles.columnKicker}>{t("home.provenance.kicker")}</div>
              <h3 className={styles.columnTitle}>{t("home.provenance.title")}</h3>
              <p className={styles.columnText}>{t("home.provenance.text")}</p>
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
