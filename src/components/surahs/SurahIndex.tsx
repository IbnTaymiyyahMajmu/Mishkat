"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useChapters } from "@/lib/store/chapters";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { useT, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import styles from "./SurahIndex.module.css";

type Order = "mushaf" | "revelation" | "length";

const ORDERS: { id: Order; label: MessageKey }[] = [
  { id: "mushaf", label: "surahs.order.mushaf" },
  { id: "revelation", label: "surahs.order.revelation" },
  { id: "length", label: "surahs.order.length" },
];

export function SurahIndex() {
  const { chapters, loading } = useChapters();
  const t = useT();
  const names = useSurahNames();
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

    // Found by any of its names, whichever of them is on screen: a reader of
    // Spanish who types "mulk" means the surah the page calls الملك.
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
            <div className="kicker">{t("surahs.kicker")}</div>
            <h1 className={styles.title}>{t("surahs.title")}</h1>
          </div>
          <input
            className={`input ${styles.filter}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("surahs.filter")}
            aria-label={t("surahs.filterLabel")}
          />
        </div>

        <div className={styles.orders} role="group" aria-label={t("surahs.sort")}>
          {ORDERS.map((o) => (
            <button
              key={o.id}
              onClick={() => setOrder(o.id)}
              disabled={o.id === "revelation" && !chapters.length}
              className={`${styles.order} ${order === o.id ? styles.orderOn : ""}`}
            >
              {t(o.label)}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span className={styles.count}>
            {t("surahs.count", { count: rows.length })}
            {loading ? ` · ${t("surahs.loadingDetails")}` : ""}
          </span>
        </div>

        {rows.length === 0 && <p className={styles.empty}>{t("surahs.none", { query: query.trim() })}</p>}

        <div className={styles.grid}>
          {rows.map((r) => (
            <Link key={r.id} href={`/read/${r.id}/`} className={styles.row}>
              <span className={styles.diamond} aria-hidden="true">
                <span className={styles.diamondNumber}>{r.id}</span>
              </span>
              <span className={styles.rowText}>
                <span className={names.arabic ? styles.rowNameArabic : styles.rowName}>{names.name(r.id)}</span>
                <span className={styles.rowMeta}>
                  {[
                    names.meaning(r.id),
                    t("common.ayat", { count: r.ayat }),
                    t(r.place === "makkah" ? "common.meccan" : "common.medinan"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {!names.arabic && <span className={styles.rowArabic}>{r.arabic}</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
