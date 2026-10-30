"use client";

import { useEffect, useId, type ReactNode } from "react";
import { weakOf, weakSpans, type Weak } from "@/lib/ulum/grades";
import { useLocale } from "@/lib/i18n";
import type { StudyCtx } from "./study";
import styles from "./AyahStudy.module.css";

/**
 * Saying that something is weak, wherever it stands: a box on a report's card, and
 * a small mark inside a book's running text that opens the same reason. Which is
 * weak, and who says so, is `src/lib/ulum/grades.ts`.
 */

/** The page in al-Itqān where al-Suyūṭī names the routes, on Shamela. */
const ITQAN = "https://shamela.ws/book/11728/1397";

function Reason({ weak }: { weak: Weak }) {
  const { t } = useLocale();
  return (
    <>
      <span className={styles.weakHead}>
        <span className={styles.weakTag}>{t(`ulum.weak.${weak.kind}`)}</span>
        <span className={styles.weakAspect}>{t(weak.aspect === "chain" ? "ulum.weak.inChain" : "ulum.weak.inText")}</span>
      </span>
      {weak.route && <span className={styles.weakWhy}>{t(`ulum.weak.why.${weak.route}`)}</span>}
      {weak.kind === "unnamed" && <span className={styles.weakWhy}>{t("ulum.weak.why.unnamed")}</span>}
      <span className={styles.weakWords} dir="rtl" lang="ar">
        «{weak.words}»
      </span>
      <span className={styles.weakBy}>
        {weak.by === "itqan" ? (
          <a href={ITQAN} target="_blank" rel="noopener noreferrer">
            {t("ulum.weak.byItqan")}
          </a>
        ) : (
          t(weak.by === "editor" ? "ulum.weak.byEditor" : "ulum.weak.byChain")
        )}
      </span>
    </>
  );
}

/** That a report is weak, how, why, and who says so. */
export function WeakNote({ weak, ctx }: { weak: Weak; ctx: StudyCtx }) {
  const { t } = useLocale();
  const place = t("ulum.ahkam.volPage", { vol: 4, page: 239 });
  const fromItqan = weak.by === "itqan";
  useEffect(() => {
    if (fromItqan) ctx.cite("al-itqan", place);
  }, [ctx, fromItqan, place]);
  return (
    <div className={styles.weak}>
      <Reason weak={weak} />
    </div>
  );
}

/** A small mark in running text; it opens the reason over the page. */
export function WeakPill({ weak }: { weak: Weak }) {
  const { t } = useLocale();
  const id = useId();
  return (
    <>
      <button type="button" className={styles.weakPill} popoverTarget={id} aria-label={t("ulum.weak.open")}>
        {t(`ulum.weak.${weak.kind}`)}
      </button>
      <span id={id} popover="auto" className={styles.weakPop}>
        <Reason weak={weak} />
      </span>
    </>
  );
}

const A_REPORT = /^\s*(?:⁕|[٠-٩\d]{1,6}\s*[-–])/u;

/** Running text with the weak routes it names marked in place. */
export function Marked({ text }: { text: string }) {
  if (A_REPORT.test(text)) {
    const weak = weakOf(text);
    if (weak) {
      return (
        <>
          <WeakPill weak={weak} /> {text}
        </>
      );
    }
    return <>{text}</>;
  }
  const spans = weakSpans(text);
  if (!spans.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let from = 0;
  spans.forEach((s, i) => {
    out.push(text.slice(from, s.from));
    out.push(
      <span key={i} className={styles.weakInline}>
        {text.slice(s.from, s.to)}
      </span>,
    );
    out.push(<WeakPill key={`p${i}`} weak={s.weak} />);
    from = s.to;
  });
  out.push(text.slice(from));
  return <>{out}</>;
}
