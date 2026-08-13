"use client";

import { useState } from "react";
import type { Chapter, Para } from "@/lib/quran/types";
import { localSurahIntro } from "@/lib/content";
import styles from "./SurahHeader.module.css";

interface Props {
  surah: number;
  chapter: Chapter | undefined;
  /** The corpus introduction, used only when nothing local has been written. */
  corpusInfo: Para[];
}

export function SurahHeader({ surah, chapter, corpusInfo }: Props) {
  const [open, setOpen] = useState(false);
  const local = localSurahIntro(surah);

  const revealed = local?.revealed ?? (chapter ? (chapter.revelation_place === "makkah" ? "Meccan" : "Medinan") : "");
  const hasIntro = !!local || corpusInfo.length > 0;

  return (
    <header className={styles.header}>
      <div className="kicker">Surah {surah}</div>
      <div className={styles.arabic}>{chapter?.name_arabic ?? ""}</div>
      <h1 className={styles.name}>{chapter?.name_simple ?? `Surah ${surah}`}</h1>
      <div className={styles.meaning}>{chapter?.translated_name?.name ?? ""}</div>

      <div className={styles.tags}>
        {revealed && <span className="tag tag-outline">{revealed}</span>}
        {chapter && <span className="tag tag-neutral">{chapter.verses_count} ayat</span>}
        {chapter && <span className="tag tag-neutral">Revealed {ordinal(chapter.revelation_order)}</span>}
        {local?.themes?.map((t) => (
          <span key={t} className="tag tag-accent">
            {t}
          </span>
        ))}
        {hasIntro && (
          <button onClick={() => setOpen((v) => !v)} className="btn btn-ghost" style={{ fontSize: 12, padding: "2px 8px" }} aria-expanded={open}>
            {open ? "Hide introduction" : "About this surah"}
          </button>
        )}
      </div>

      {open && hasIntro && (
        <div className={styles.intro}>
          <div className="kicker kicker-sm" style={{ marginBottom: 10 }}>
            {local ? local.title ?? "About this surah" : "About this surah"}
          </div>

          {local
            ? local.paragraphs.map((text, i) => (
                <p key={i} className={styles.para}>
                  {text}
                </p>
              ))
            : corpusInfo.slice(0, 8).map((p, i) => (
                <p key={i} dir={p.rtl ? "rtl" : "ltr"} className={`${styles.para} ${p.rtl ? styles.paraArabic : ""} ${p.heading ? styles.paraHeading : ""}`}>
                  {p.text}
                </p>
              ))}

          {local?.arabicParagraphs?.map((text, i) => (
            <p key={`ar-${i}`} dir="rtl" className={`${styles.para} ${styles.paraArabic}`}>
              {text}
            </p>
          ))}

          {/* An introduction without a stated source is the thing this product
              is trying not to publish, so the source is part of the block. */}
          <div className={styles.source}>
            Source:{" "}
            {local ? (
              local.sourceUrl ? (
                <a href={local.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {local.source}
                </a>
              ) : (
                local.source
              )
            ) : (
              "Quran.com chapter information"
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function ordinal(n: number): string {
  if (!n) return "";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
