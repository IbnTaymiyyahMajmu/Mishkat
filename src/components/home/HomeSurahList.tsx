"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { juzRows } from "@/lib/quran/juz";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { useChapters } from "@/lib/store/chapters";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import styles from "./HomeSurahList.module.css";

type Tab = "order" | "juz" | "revelation";

const TABS: { id: Tab; label: MessageKey; title: MessageKey }[] = [
  { id: "order", label: "homeList.order.label", title: "homeList.order.title" },
  { id: "juz", label: "homeList.juz.label", title: "homeList.juz.title" },
  { id: "revelation", label: "homeList.revelation.label", title: "homeList.revelation.title" },
];

interface Row {
  href: string;
  badge: string;
  name: string;
  sub: string;
  /** The surah whose Arabic name stands at the far end of the row. */
  surah: number;
}

/**
 * The whole book, on the landing page.
 *
 * The reader arrives at an ayah, not at a menu; the list is what they scroll
 * down into once they have read it. It is the entire muṣḥaf in three orders —
 * as it is bound, as it is divided for recitation, and as it was revealed — and
 * not a shortlist, because a shortlist is an editorial claim about which surahs
 * matter.
 */
export function HomeSurahList() {
  const { chapters, byId } = useChapters();
  const { t, arrows } = useLocale();
  const names = useSurahNames();
  const [tab, setTab] = useState<Tab>("order");

  // Until the live chapter table lands the baked-in names carry the list, so
  // the section is never 114 empty rows waiting on a network call. Revelation
  // order is the one thing the baked table does not know.
  const live = chapters.length > 0;

  const rows = useMemo<Row[]>(() => {
    if (tab === "juz") {
      return juzRows(names.name, t, arrows.next).map((j) => ({
        href: `/read/${j.startSurah}/#${j.startKey}`,
        badge: t("common.juzN", { n: j.n }),
        name: j.range,
        sub: j.sub,
        surah: j.startSurah,
      }));
    }

    const base = live
      ? chapters.map((c) => ({
          id: c.id,
          ayat: c.verses_count,
          meccan: c.revelation_place === "makkah",
          revelationOrder: c.revelation_order,
        }))
      : SURAH_NAMES.map((s, i) => ({
          id: i + 1,
          ayat: s.ayat,
          meccan: s.place === "makkah",
          revelationOrder: i + 1,
        }));

    const byRevelation = tab === "revelation";
    return [...base]
      .sort((a, b) =>
        byRevelation ? a.revelationOrder - b.revelationOrder : a.id - b.id,
      )
      .map((c) => ({
        href: `/read/${c.id}/`,
        badge: String(byRevelation ? c.revelationOrder : c.id),
        name: names.name(c.id),
        sub: (byRevelation
          ? [t("common.surahN", { n: c.id }), t(c.meccan ? "common.meccan" : "common.medinan")]
          : [names.meaning(c.id)]
        )
          .concat(t("common.ayat", { count: c.ayat }))
          .filter(Boolean)
          .join(" · "),
        surah: c.id,
      }));
  }, [tab, chapters, live, names, t, arrows]);

  const title = TABS.find((x) => x.id === tab)?.title;
  const juz = tab === "juz";

  return (
    <section id="surahs" className={styles.section} aria-labelledby="home-surah-list">
      <div className={styles.head}>
        <h2 id="home-surah-list" className={styles.title}>
          {title ? t(title) : ""}
        </h2>
        <div className={styles.tabs} role="group" aria-label={t("homeList.group")}>
          {TABS.map((x) => (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              disabled={x.id === "revelation" && !live}
              aria-pressed={tab === x.id}
              className={`${styles.tab} ${tab === x.id ? styles.tabOn : ""}`}
            >
              {t(x.label)}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.rule} />

      <div className={`${styles.grid} ${juz ? styles.gridJuz : ""}`}>
        {rows.map((r) => (
          <Link key={r.href + r.badge} href={r.href} className={styles.row}>
            <span className={`${styles.badge} ${juz ? styles.badgeJuz : ""}`}>{r.badge}</span>
            <span className={styles.text}>
              <span className={`${styles.name} ${names.arabic && !juz ? styles.nameArabic : ""}`}>{r.name}</span>
              <span className={styles.sub}>{r.sub}</span>
            </span>
            {/* Beside a name in Latin letters, the name as it is written. Where
                the row is named in Arabic already it would be the same word
                a second time. */}
            {!names.arabic && (
              <span className={styles.arabic}>{byId(r.surah)?.name_arabic ?? SURAH_NAMES[r.surah - 1]?.arabic}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
