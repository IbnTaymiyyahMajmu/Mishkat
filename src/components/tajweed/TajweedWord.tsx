"use client";

import { memo, useMemo } from "react";
import { RULES, parseTajweed, type Family, type Rule } from "@/lib/quran/tajweed";
import styles from "./Tajweed.module.css";

/** The class a family is spotlit by. */
export const FAMILY_CLASS: Record<Family, string> = {
  hold: styles.hold,
  nasal: styles.nasalFamily,
  bounce: styles.bounceFamily,
  merge: styles.mergeFamily,
  silent: styles.silentFamily,
};

/** The class a rule is coloured by. */
export function toneClass(rule: Rule): string {
  return styles[RULES[rule].tone];
}

/**
 * A word with its tajweed in colour: each run of letters a rule applies to is
 * a span carrying the rule's name (`data-tj`), which is what a tap on it is
 * read from. The signs for stopping carry theirs (`data-waqf`).
 */
function TajweedWordImpl({ markup, picked }: { markup: string; picked?: Rule | null }) {
  const segments = useMemo(() => parseTajweed(markup), [markup]);
  return (
    <>
      {segments.map((s, i) => {
        if (s.rule) {
          const info = RULES[s.rule];
          return (
            <span
              key={i}
              data-tj={s.rule}
              className={`${styles.seg} ${styles[info.tone]} ${FAMILY_CLASS[info.family]} ${picked === s.rule ? styles.picked : ""}`}
            >
              {s.text}
            </span>
          );
        }
        if (s.waqf) {
          return (
            <span key={i} data-waqf={s.waqf} className={styles.waqf}>
              {s.text}
            </span>
          );
        }
        return s.text;
      })}
    </>
  );
}

export const TajweedWord = memo(TajweedWordImpl);
