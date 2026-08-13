"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { juzRows } from "@/lib/quran/juz";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { useChapters } from "@/lib/store/chapters";
import styles from "./HomeSurahList.module.css";

type Tab = "order" | "juz" | "revelation";

const TABS: { id: Tab; label: string; title: string }[] = [
  { id: "order", label: "Muṣḥaf order", title: "All 114 surahs" },
  { id: "juz", label: "By juz", title: "The thirty juz" },
  { id: "revelation", label: "By revelation", title: "In the order revealed" },
];

interface Row {
  href: string;
  badge: string;
  name: string;
  sub: string;
  arabic: string;
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
  const [tab, setTab] = useState<Tab>("order");

  // Until the live chapter table lands the baked-in names carry the list, so
  // the section is never 114 empty rows waiting on a network call. Revelation
  // order is the one thing the baked table does not know.
  const live = chapters.length > 0;

  const rows = useMemo<Row[]>(() => {
    if (tab === "juz") {
      return juzRows(byId).map((j) => ({
        href: `/read/${j.startSurah}/#${j.startKey}`,
        badge: `Juz ${j.n}`,
        name: j.range,
        sub: j.sub,
        arabic: j.arabic,
      }));
    }

    const base = live
      ? chapters.map((c) => ({
          id: c.id,
          english: c.name_simple,
          arabic: c.name_arabic,
          meaning: c.translated_name?.name ?? "",
          ayat: c.verses_count,
          meccan: c.revelation_place === "makkah",
          revelationOrder: c.revelation_order,
        }))
      : SURAH_NAMES.map((s, i) => ({
          id: i + 1,
          english: s.english,
          arabic: s.arabic,
          meaning: s.meaning,
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
        name: c.english,
        sub: byRevelation
          ? `Surah ${c.id} · ${c.meccan ? "Meccan" : "Medinan"} · ${c.ayat} ayat`
          : `${c.meaning} · ${c.ayat} ayat`,
        arabic: c.arabic,
      }));
  }, [tab, chapters, byId, live]);

  const title = TABS.find((t) => t.id === tab)?.title ?? "";
  const juz = tab === "juz";

  return (
    <section id="surahs" className={styles.section} aria-labelledby="home-surah-list">
      <div className={styles.head}>
        <h2 id="home-surah-list" className={styles.title}>
          {title}
        </h2>
        <div className={styles.tabs} role="group" aria-label="How to list the Qur'an">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              disabled={t.id === "revelation" && !live}
              aria-pressed={tab === t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabOn : ""}`}
            >
              {t.label}
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
              <span className={styles.name}>{r.name}</span>
              <span className={styles.sub}>{r.sub}</span>
            </span>
            <span className={styles.arabic}>{r.arabic}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
