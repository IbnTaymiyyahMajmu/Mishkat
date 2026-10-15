"use client";

import { useEffect, useRef, useState } from "react";
import { RULES, WAQF_MARK, type Rule, type Stop, type Waqf } from "@/lib/quran/tajweed";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { toneClass } from "./TajweedWord";
import tj from "./Tajweed.module.css";
import styles from "./Cards.module.css";

/**
 * The cards that say what a rule is, what a sign for stopping means, and what
 * to do on stopping at a word — shared by the panel beside the reader and the
 * guide, so a rule is explained in the same words wherever it is met.
 */

/** How long one count is: about the time it takes to say a short vowel twice over, unhurried. */
const BEAT = 480;

/**
 * The length of a lengthening, made something to see and keep time with: a
 * row of dots that light one a count. A reader who has never been told what
 * "four counts" means is shown it.
 */
export function Beats({ counts }: { counts: number[] }) {
  const { t, n } = useLocale();
  const most = Math.max(...counts);
  const [lit, setLit] = useState(0);
  const [running, setRunning] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  const run = (to: number) => {
    if (timer.current) clearInterval(timer.current);
    setRunning(to);
    setLit(1);
    let k = 1;
    timer.current = setInterval(() => {
      k += 1;
      if (k > to) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setRunning(null);
        return;
      }
      setLit(k);
    }, BEAT);
  };

  return (
    <div className={styles.beats}>
      <div className={styles.dots} aria-hidden="true">
        {Array.from({ length: most }, (_, i) => (
          <span
            key={i}
            className={`${styles.dot} ${i < lit ? styles.dotOn : ""} ${counts.includes(i + 1) ? styles.dotStop : ""}`}
          />
        ))}
      </div>
      <div className={styles.beatButtons}>
        {counts.map((c) => (
          <button key={c} type="button" className={`btn btn-ghost ${styles.beatButton}`} onClick={() => run(c)}>
            {counts.length > 1 ? t("tj.countTo", { count: c, countText: n(c) }) : t("tj.countIt", { count: c, countText: n(c) })}
          </button>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {running !== null ? n(lit) : ""}
      </span>
    </div>
  );
}

/** How many counts a rule is held for, said: "2 counts", "4 or 5 counts", "2, 4 or 6 counts". */
export function useCountsText() {
  const { t, n } = useLocale();
  return (counts: number[]) => {
    const most = Math.max(...counts);
    const unit = t("tj.countsUnit", { count: most });
    if (counts.length === 1) return `${n(counts[0])} ${unit}`;
    const head = counts.slice(0, -1).map(n).join(t("tj.listJoin"));
    return `${t("tj.or", { a: head, b: n(counts[counts.length - 1]) })} ${unit}`;
  };
}

export function RuleCard({ rule, picked = false }: { rule: Rule; picked?: boolean }) {
  const { t } = useLocale();
  const info = RULES[rule];
  const countsText = useCountsText();
  const key = (part: "name" | "do" | "when") => `tj.rule.${rule}.${part}` as MessageKey;
  return (
    <article className={`${styles.card} ${picked ? styles.cardPicked : ""}`}>
      <header className={styles.cardHead}>
        <span className={`${tj.swatch} ${toneClass(rule)}`} aria-hidden="true" />
        <span className={styles.cardName}>{t(key("name"))}</span>
        <span lang="ar" dir="rtl" className={styles.cardArabic}>
          {info.arabic}
        </span>
      </header>
      <p className={styles.cardDo}>
        {t(key("do"))}
        {info.counts && <span className={styles.cardCounts}> {countsText(info.counts)}</span>}
      </p>
      <p className={styles.cardWhen}>{t(key("when"))}</p>
      {info.counts && <Beats counts={info.counts} />}
    </article>
  );
}

export function WaqfCard({ waqf }: { waqf: Waqf }) {
  const { t } = useLocale();
  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <span lang="ar" dir="rtl" className={styles.waqfMark} aria-hidden="true">
          {WAQF_MARK[waqf]}
        </span>
        <span className={styles.cardName}>{t(`tj.waqf.${waqf}.name` as MessageKey)}</span>
      </header>
      <p className={styles.cardDo}>{t(`tj.waqf.${waqf}.do` as MessageKey)}</p>
    </article>
  );
}

export function StopCard({ stops }: { stops: Stop[] }) {
  const { t } = useLocale();
  if (!stops.length) return null;
  return (
    <article className={`${styles.card} ${styles.stopCard}`}>
      <header className={styles.cardHead}>
        <span className={styles.stopIcon} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 5v14M16 5v14" />
          </svg>
        </span>
        <span className={styles.cardName}>{t("tj.stop.title")}</span>
      </header>
      <ul className={styles.stops}>
        {stops.map((s) => (
          <li key={s}>{t(`tj.stop.${s}` as MessageKey)}</li>
        ))}
      </ul>
    </article>
  );
}
