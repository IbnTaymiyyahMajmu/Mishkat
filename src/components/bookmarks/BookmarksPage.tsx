"use client";

import Link from "next/link";
import { useState } from "react";
import { useLibrary } from "@/lib/store/library";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { useGoToVerse } from "@/lib/useGoToVerse";
import styles from "./BookmarksPage.module.css";

type Order = "recent" | "mushaf";

export function BookmarksPage() {
  const { bookmarks, ready, removeBookmark } = useLibrary();
  const goToVerse = useGoToVerse();
  const toast = useToast();
  const { t, date, arrows } = useLocale();
  const names = useSurahNames();
  const [order, setOrder] = useState<Order>("recent");

  const surahName = names.name;

  const rows =
    order === "recent"
      ? bookmarks
      : [...bookmarks].sort((a, b) => {
          const [as, aa] = a.verseKey.split(":").map(Number);
          const [bs, ba] = b.verseKey.split(":").map(Number);
          return as - bs || aa - ba;
        });

  return (
    <div className="page-shell">
      <div className={styles.body}>
        <header className={styles.head}>
          <div className="kicker">{t("bookmarks.kicker")}</div>
          <h1 className={styles.title}>{t("bookmarks.title")}</h1>
          <p className={styles.sub}>
            {t("bookmarks.sub")}
          </p>
        </header>

        {bookmarks.length > 0 && (
          <div className={styles.orders}>
            <button
              className={`${styles.order} ${order === "recent" ? styles.orderOn : ""}`}
              onClick={() => setOrder("recent")}
            >
              {t("bookmarks.recent")}
            </button>
            <button
              className={`${styles.order} ${order === "mushaf" ? styles.orderOn : ""}`}
              onClick={() => setOrder("mushaf")}
            >
              {t("bookmarks.mushaf")}
            </button>
            <div style={{ flex: 1 }} />
            <span className={styles.count}>
              {t("common.ayat", { count: bookmarks.length })}
            </span>
          </div>
        )}

        {ready && bookmarks.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyMark}>۞</div>
            <p className={styles.emptyText}>{t("bookmarks.empty")}</p>
            <Link href="/read/1/" className="btn btn-primary">
              {t("common.openReader")}
            </Link>
          </div>
        )}

        {rows.map((b) => (
          <article key={b.id} className={styles.card}>
            <div className={styles.cardHead}>
              <span className="tag tag-outline" style={{ fontVariantNumeric: "tabular-nums" }}>
                {b.verseKey}
              </span>
              <span className={styles.cardSurah}>{surahName(b.surah)}</span>
              <span className={styles.cardRule} />
              <span className={styles.cardWhen}>{date(b.createdAt)}</span>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => {
                  removeBookmark(b.id);
                  toast(t("toast.bookmarkRemoved"));
                }}
              >
                {t("bookmarks.remove")}
              </button>
            </div>

            <div dir="rtl" className={styles.cardArabic}>
              {b.arabic}
            </div>

            {b.translation && (
              <p className={styles.cardTranslation} dir="auto">
                {b.translation}
              </p>
            )}
            {b.translator && <div className={styles.cardTranslator}>{b.translator}</div>}

            <button
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: "5px 12px", marginTop: 12 }}
              onClick={() => goToVerse(b.verseKey)}
            >
              {t("bookmarks.return")} {arrows.next}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
