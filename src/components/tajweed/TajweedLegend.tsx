"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FAMILIES, familyCounts, type Family, type SurahTajweed } from "@/lib/quran/tajweed";
import { useLocale, type MessageKey } from "@/lib/i18n";
import tj from "./Tajweed.module.css";
import styles from "./TajweedLegend.module.css";

/** A family's colour in the legend: the first of its rules' tones. */
const FAMILY_TONE: Record<Family, string> = {
  hold: tj.madd45,
  nasal: tj.nasal,
  bounce: tj.bounce,
  merge: tj.merge,
  silent: tj.silent,
};

/**
 * The attributes that tell a coloured text which families to show: none
 * chosen is all of them. Spread onto the element that holds the text, beside
 * the `spot` class of Tajweed.module.css.
 */
export function spotlight(focus: Family[]): Record<string, string> {
  if (!focus.length) return {};
  const out: Record<string, string> = { "data-tj-focus": "" };
  for (const f of focus) out[`data-tj-show-${f}`] = "";
  return out;
}

/**
 * What the colours mean, over a text read in colour — and a way to look at
 * some families and not others. Any of the five can be chosen together: the
 * merging and the silent letters, say, or the bounce and the nasal sounds.
 * Choosing all five is the same as All, and becomes it.
 */
export function TajweedLegend({
  map,
  focus,
  onFocus,
  compact = false,
}: {
  map: SurahTajweed | null;
  focus: Family[];
  onFocus: (families: Family[]) => void;
  /** Drawn inside a toolbar rather than over the text. */
  compact?: boolean;
}) {
  const { t, n } = useLocale();
  const counts = useMemo(() => (map ? familyCounts(map) : null), [map]);

  const toggle = (f: Family) => {
    const next = focus.includes(f) ? focus.filter((x) => x !== f) : [...focus, f];
    onFocus(next.length === FAMILIES.length ? [] : FAMILIES.filter((x) => next.includes(x)));
  };

  return (
    <div className={`${styles.legend} ${compact ? styles.compact : ""}`} role="group" aria-label={t("tj.legend.label")}>
      <button
        type="button"
        className={`${styles.chip} ${focus.length === 0 ? styles.chipOn : ""}`}
        aria-pressed={focus.length === 0}
        onClick={() => onFocus([])}
      >
        {t("tj.legend.all")}
      </button>
      {FAMILIES.map((f) => {
        const on = focus.includes(f);
        return (
          <button
            key={f}
            type="button"
            className={`${styles.chip} ${on ? styles.chipOn : ""} ${focus.length && !on ? styles.chipOff : ""}`}
            aria-pressed={on}
            onClick={() => toggle(f)}
            title={t(`tj.familyDo.${f}` as MessageKey)}
          >
            <span className={`${tj.swatch} ${FAMILY_TONE[f]}`} aria-hidden="true" />
            {t(`tj.family.${f}` as MessageKey)}
            {counts && !compact && <span className={styles.count}>{n(counts[f])}</span>}
            {on && (
              <svg className={styles.tick} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
          </button>
        );
      })}
      <Link href="/tajweed/" className={styles.guide}>
        {compact ? "?" : t("tj.legend.guide")}
      </Link>
    </div>
  );
}
