"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useChapters } from "@/lib/store/chapters";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import styles from "./SurahIndex.module.css";

type Order = "mushaf" | "revelation" | "length";

const ORDERS: { id: Order; label: string }[] = [
  { id: "mushaf", label: "Muṣḥaf order" },
  { id: "revelation", label: "Order of revelation" },
  { id: "length", label: "Longest first" },
];

export function SurahIndex() {
  const { chapters, loading } = useChapters();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<Order>("mushaf");

  // The index reads from the baked-in table until the live chapter data lands,
  // so it is never an empty page waiting on a network call.
  const rows = useMemo(() => {
    const base =
      chapters.length > 0
        ? chapters.map((c) => ({
            id: c.id,
            english: c.name_simple,
            arabic: c.name_arabic,
            meaning: c.translated_name?.name ?? "",
            ayat: c.verses_count,
            place: c.revelation_place,
            revelationOrder: c.revelation_order,
          }))
        : SURAH_NAMES.map((s, i) => ({
            id: i + 1,
            english: s.english,
            arabic: s.arabic,
            meaning: s.meaning,
            ayat: s.ayat,
            place: s.place,
            revelationOrder: 0,
          }));

    const q = query.trim().toLowerCase();
    const filtered = q
      ? base.filter(
          (r) =>
            r.english.toLowerCase().includes(q) ||
            r.meaning.toLowerCase().includes(q) ||
            r.arabic.includes(query.trim()) ||
            String(r.id) === q,
        )
      : base;

    const sorted = [...filtered];
    if (order === "revelation" && chapters.length) {
      sorted.sort((a, b) => a.revelationOrder - b.revelationOrder);
    } else if (order === "length") {
      sorted.sort((a, b) => b.ayat - a.ayat);
    }
    return sorted;
  }, [chapters, query, order]);

  return (
    <div className="page-shell">
      <div className={styles.body}>
        <div className={styles.head}>
          <div>
            <div className="kicker">Contents</div>
            <h1 className={styles.title}>The one hundred and fourteen</h1>
          </div>
          <input
            className={`input ${styles.filter}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, meaning or number"
            aria-label="Filter surahs"
          />
        </div>

        <div className={styles.orders} role="group" aria-label="Sort order">
          {ORDERS.map((o) => (
            <button
              key={o.id}
              onClick={() => setOrder(o.id)}
              disabled={o.id === "revelation" && !chapters.length}
              className={`${styles.order} ${order === o.id ? styles.orderOn : ""}`}
            >
              {o.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span className={styles.count}>
            {rows.length} {rows.length === 1 ? "surah" : "surahs"}
            {loading ? " · loading details…" : ""}
          </span>
        </div>

        {rows.length === 0 && (
          <p className={styles.empty}>Nothing matches “{query.trim()}”.</p>
        )}

        <div className={styles.grid}>
          {rows.map((r) => (
            <Link key={r.id} href={`/read/${r.id}/`} className={styles.row}>
              <span className={styles.diamond} aria-hidden="true">
                <span className={styles.diamondNumber}>{r.id}</span>
              </span>
              <span className={styles.rowText}>
                <span className={styles.rowName}>{r.english}</span>
                <span className={styles.rowMeta}>
                  {r.meaning} · {r.ayat} ayat · {r.place === "makkah" ? "Meccan" : "Medinan"}
                </span>
              </span>
              <span className={styles.rowArabic}>{r.arabic}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
