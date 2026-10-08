"use client";

import Link from "next/link";
import type { IntroTeaser } from "@/lib/intros/types";
import type { Chapter } from "@/lib/quran/types";
import { useLocale } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { ordinal } from "@/lib/text";
import styles from "./SurahHeader.module.css";

interface Props {
  surah: number;
  chapter: Chapter | undefined;
  /** The opening of the surah's introduction, where one has been written. */
  teaser: IntroTeaser | null;
}

/**
 * The head of a surah in the reader: its name, what can be said of it in a
 * line, and the door to its introduction.
 *
 * The introduction itself is a page of its own (`/read/<n>/about/`). What
 * stands here is its first two lines — enough to say what the surah is, and
 * to make the rest worth opening — rather than a fold with the whole of it
 * inside, which is what this used to be.
 */
export function SurahHeader({ surah, chapter, teaser }: Props) {
  const { t, locale, arrows } = useLocale();
  const names = useSurahNames();
  const meaning = names.meaning(surah);

  return (
    <header className={styles.header}>
      <div className="kicker">{t("common.surahN", { n: surah })}</div>
      {names.arabic ? (
        // Named in Arabic alone: the Arabic is the heading, not an ornament
        // over one.
        <h1 className={`${styles.arabic} ${styles.arabicHeading}`}>{chapter?.name_arabic ?? names.name(surah)}</h1>
      ) : (
        <>
          <div className={styles.arabic}>{chapter?.name_arabic ?? ""}</div>
          <h1 className={styles.name}>{names.name(surah)}</h1>
          <div className={styles.meaning}>{meaning}</div>
        </>
      )}

      <div className={styles.tags}>
        {chapter && (
          <span className="tag tag-outline">
            {t(chapter.revelation_place === "makkah" ? "common.meccan" : "common.medinan")}
          </span>
        )}
        {chapter && <span className="tag tag-neutral">{t("common.ayat", { count: chapter.verses_count })}</span>}
        {chapter && !!chapter.revelation_order && (
          <span className="tag tag-neutral">
            {t("surahHeader.revealed", { order: ordinal(chapter.revelation_order, locale) })}
          </span>
        )}
      </div>

      <div className={styles.intro}>
        {teaser && (
          // Written in English whatever language the site is in: it is the
          // introduction's own text, not the site's words about it.
          <div lang="en" dir="ltr">
            <p className={styles.epithet}>{teaser.epithet}</p>
            <p className={styles.lede}>{teaser.lede}</p>
          </div>
        )}
        <Link href={`/read/${surah}/about/`} className={styles.introLink}>
          {t(teaser ? "surahHeader.introduction" : "surahHeader.about")} {arrows.next}
        </Link>
      </div>
    </header>
  );
}
