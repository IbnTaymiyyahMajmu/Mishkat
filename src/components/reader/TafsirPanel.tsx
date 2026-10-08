"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { Verse } from "@/lib/quran/types";
import { TafsirReading } from "@/components/tafsir/TafsirReading";
import { TafsirLibrary, TafsirTabs } from "@/components/tafsir/TafsirShelf";
import { useTafsirShelf } from "@/components/tafsir/useTafsirShelf";
import shared from "@/components/tafsir/Tafsir.module.css";
import { useT } from "@/lib/i18n";
import styles from "./Panels.module.css";

interface Props {
  verse: Verse | undefined;
  verseKey: string;
  /** How many ayat the surah has, so the panel knows where it ends. */
  ayahCount: number;
  /** Take the panel — and the text beside it — to another ayah of this surah. */
  onMove: (verseKey: string) => void;
}

/**
 * Tafsir, beside the ayah.
 *
 * This is the quick way in: the reader is in the text, wants to know what an
 * ayah means, and should have an answer without leaving it. So it opens on one
 * work — the last one they were reading — already showing, with the others
 * they keep a press away as tabs, and the whole library behind one button.
 *
 * It used to lay every selected work out one under another, each cut off at
 * six paragraphs. Comparing two meant scrolling, and reading one at length
 * meant unfolding it in a column a few hundred pixels wide. Now a work is read
 * one at a time here, and a long one is given a page of its own: the link to
 * that page is always in sight.
 *
 * And it moves. "Next" takes the panel and the text to the next ayah the work
 * has not already covered, so a surah can be read through with its tafsir
 * beside it, a press at a time.
 */
export function TafsirPanel({ verse, verseKey, ayahCount, onMove }: Props) {
  const router = useRouter();
  const t = useT();
  const { shelf, works, active, pick, toggle, scale, resize } = useTafsirShelf();
  const [choosing, setChoosing] = useState(false);
  /** The ayat the passage on screen covers, once it has said. */
  const [range, setRange] = useState<{ key: string; from: number; to: number } | null>(null);

  const [surah, ayahText] = verseKey.split(":");
  const ayah = Number(ayahText);
  const slot = `${active?.id}|${verseKey}`;
  const covered = range?.key === slot ? range : null;

  // Told by the passage itself, once it has arrived. The same answer twice is
  // the same object, or telling would re-render and re-rendering would tell.
  const onRange = useCallback(
    (r: { from: number; to: number } | null) =>
      setRange((held) => {
        if (!r) return held?.key === slot ? null : held;
        return held?.key === slot && held.from === r.from && held.to === r.to ? held : { key: slot, ...r };
      }),
    [slot],
  );

  // A passage on ayat 1–14 is stepped past as one: the next thing to read is
  // ayah 15, not the same fourteen under a different number.
  const prev = (covered?.from ?? ayah) - 1;
  const next = (covered?.to ?? ayah) + 1;
  const total = Math.max(ayahCount, ayah);

  return (
    <div style={{ "--tafsir-scale": scale } as React.CSSProperties}>
      {verse && (
        <div dir="rtl" lang="ar" className={styles.tafsirVerse}>
          {verse.text_uthmani}
        </div>
      )}

      <div className={styles.tafsirBar}>
        <TafsirTabs
          works={works}
          active={active?.id ?? ""}
          onPick={(id) => {
            pick(id);
            setChoosing(false);
          }}
          choosing={choosing}
          onChoose={() => setChoosing((v) => !v)}
        />

        <div className={styles.stepper}>
          <button
            className={styles.step}
            onClick={() => onMove(`${surah}:${prev}`)}
            disabled={prev < 1}
            aria-label={t("panel.prev", { n: prev })}
          >
            ‹ {prev >= 1 ? prev : ""}
          </button>
          <span className={styles.stepHere}>
            {t("common.ayahOf", { n: ayah, total })}
          </span>
          <button
            className={styles.step}
            onClick={() => onMove(`${surah}:${next}`)}
            disabled={next > total}
            aria-label={t("panel.next", { n: next })}
          >
            {next <= total ? next : ""} ›
          </button>

          <span className={styles.stepGap} />

          <span className={styles.sizer} role="group" aria-label={t("tafsir.textSize")}>
            <button onClick={() => resize(-1)} disabled={scale <= 0.86} aria-label={t("tafsir.smaller")}>
              A−
            </button>
            <button onClick={() => resize(1)} disabled={scale >= 1.59} aria-label={t("tafsir.larger")}>
              A+
            </button>
          </span>
          <Link
            href={`/tafsir/?v=${verseKey}${active ? `&w=${encodeURIComponent(active.id)}` : ""}`}
            className={styles.fullPage}
            title={t("tafsir.fullPageTitle")}
          >
            {t("tafsir.fullPage")} ↗
          </Link>
        </div>
      </div>

      {choosing ? (
        <TafsirLibrary
          shelf={shelf}
          active={active?.id}
          onPick={(id) => {
            pick(id);
            setChoosing(false);
          }}
          onToggle={toggle}
        />
      ) : (
        active && (
          <TafsirReading
            key={active.id}
            work={active}
            verseKey={verseKey}
            opening={9}
            onRange={onRange}
            alternatives={works.filter((w) => w.id !== active.id)}
            onPick={pick}
            // Two works abreast want a page's width, so that is where they go.
            onBeside={(id) =>
              router.push(`/tafsir/?v=${verseKey}&w=${encodeURIComponent(active.id)}&c=${encodeURIComponent(id)}`)
            }
          />
        )
      )}

      {!choosing && (
        <p className={shared.footNote} style={{ marginTop: 18 }}>
          {t("tafsir.promise")}
        </p>
      )}
    </div>
  );
}
