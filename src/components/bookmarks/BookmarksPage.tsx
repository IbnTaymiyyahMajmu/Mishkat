"use client";

import Link from "next/link";
import { useState } from "react";
import { useLibrary } from "@/lib/store/library";
import { useChapters } from "@/lib/store/chapters";
import { useToast } from "@/components/Toast";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { formatDate } from "@/lib/text";
import { useGoToVerse } from "@/lib/useGoToVerse";
import styles from "./BookmarksPage.module.css";

type Order = "recent" | "mushaf";

export function BookmarksPage() {
  const { bookmarks, ready, removeBookmark } = useLibrary();
  const { byId } = useChapters();
  const goToVerse = useGoToVerse();
  const toast = useToast();
  const [order, setOrder] = useState<Order>("recent");

  const surahName = (n: number) => byId(n)?.name_simple ?? SURAH_NAMES[n - 1]?.english ?? `Surah ${n}`;

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
          <div className="kicker">Saved</div>
          <h1 className={styles.title}>Bookmarks</h1>
          <p className={styles.sub}>
            Stored on this device only. Nothing about your reading leaves the browser.
          </p>
        </header>

        {bookmarks.length > 0 && (
          <div className={styles.orders}>
            <button
              className={`${styles.order} ${order === "recent" ? styles.orderOn : ""}`}
              onClick={() => setOrder("recent")}
            >
              Most recent
            </button>
            <button
              className={`${styles.order} ${order === "mushaf" ? styles.orderOn : ""}`}
              onClick={() => setOrder("mushaf")}
            >
              Muṣḥaf order
            </button>
            <div style={{ flex: 1 }} />
            <span className={styles.count}>
              {bookmarks.length} {bookmarks.length === 1 ? "ayah" : "ayat"}
            </span>
          </div>
        )}

        {ready && bookmarks.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyMark}>۞</div>
            <p className={styles.emptyText}>No ayat saved yet.</p>
            <Link href="/read/1/" className="btn btn-primary">
              Open the reader
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
              <span className={styles.cardWhen}>{formatDate(b.createdAt)}</span>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => {
                  removeBookmark(b.id);
                  toast("Bookmark removed");
                }}
              >
                Remove
              </button>
            </div>

            <div dir="rtl" className={styles.cardArabic}>
              {b.arabic}
            </div>

            {b.translation && <p className={styles.cardTranslation}>{b.translation}</p>}
            {b.translator && <div className={styles.cardTranslator}>{b.translator}</div>}

            <button
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: "5px 12px", marginTop: 12 }}
              onClick={() => goToVerse(b.verseKey)}
            >
              Return to this ayah →
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
