"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { ENOUGH, dayOffset, standing, usePlan } from "@/lib/store/plan";
import { dayKey, useReadingLog } from "@/lib/store/reading";
import { useLocale } from "@/lib/i18n";
import { usePlanWords } from "./words";
import styles from "./PlanStrip.module.css";

const noSubscription = () => () => {};
const useReady = () => useSyncExternalStore(noSubscription, () => true, () => false);

/**
 * The plan on the landing page, for a reader who has one: one quiet line
 * under the ayah — today's portion and how far into it they are — that opens
 * the plan. The landing page is one ayah and not a menu, and this is the one
 * thing a returning reader came back for.
 */
export function PlanLine() {
  const ready = useReady();
  const { plan } = usePlan();
  const log = useReadingLog();
  const { t, n } = useLocale();
  const words = usePlanWords();
  const now = dayKey();
  const s = useMemo(() => (plan && !plan.closed ? standing(plan, log, now) : null), [plan, log, now]);

  if (!ready || !plan || !s || s.today < 0 || s.complete) return null;
  const at = Math.min(s.current, s.portions.length - 1);
  const portion = s.portions[at];
  if (!portion) return null;
  const read = Math.min(1, s.read[at]);
  const todayDone = s.today >= 0 && s.today < s.portions.length && s.read[s.today] >= ENOUGH;
  const offset = dayOffset(plan);

  return (
    <Link href="/plan/" className={styles.line}>
      <span className={styles.dial} style={{ "--p": `${Math.round(read * 100)}%` } as React.CSSProperties} aria-hidden="true" />
      <span className={styles.lineText}>
        <span className={styles.lineKicker}>
          {todayDone ? t("plan.today.done") : t("plan.home.today")}
          {" · "}
          {t("plan.dayOf", { day: n(offset + Math.min(s.today, s.portions.length - 1) + 1), days: n(offset + s.portions.length) })}
        </span>
        <span className={styles.lineRange}>
          {words.range(portion.from, portion.to)}
          {read > 0 && <span className={styles.linePercent}>{` · ${t("plan.today.percent", { percent: n(Math.floor(read * 100)) })}`}</span>}
        </span>
      </span>
    </Link>
  );
}

/**
 * The way to the plan from the reader, beside the muṣḥaf and the notes: with a
 * plan, how far into today's portion the reader is; without one, an offer.
 */
export function PlanPill() {
  const ready = useReady();
  const { plan } = usePlan();
  const log = useReadingLog();
  const { t, n } = useLocale();
  const now = dayKey();
  const s = useMemo(() => (plan && !plan.closed ? standing(plan, log, now) : null), [plan, log, now]);
  const at = s && s.today >= 0 && !s.complete ? Math.min(s.current, s.portions.length - 1) : -1;
  const read = s && at >= 0 ? Math.min(1, s.read[at]) : 0;
  return (
    <Link
      href="/plan/"
      className={`btn btn-secondary ${styles.pill}`}
      title={s && at >= 0 ? t("plan.home.today") : t("plan.home.invite")}
    >
      {ready && s && at >= 0 && (
        <span className={styles.pillDial} style={{ "--p": `${Math.round(read * 100)}%` } as React.CSSProperties} aria-hidden="true" />
      )}
      {t("nav.plan")}
      {ready && s && at >= 0 && <span className={styles.pillPercent}>{`${n(Math.floor(read * 100))}%`}</span>}
    </Link>
  );
}

/** An invitation to make a plan, further down the landing page, for a reader without one. */
export function PlanInvite() {
  const ready = useReady();
  const { plan } = usePlan();
  const { t, arrows } = useLocale();
  if (!ready || (plan && !plan.closed)) return null;
  return (
    <Link href="/plan/" className={styles.invite}>
      <span className={styles.inviteKicker}>{t("plan.home.kicker")}</span>
      <span className={styles.inviteTitle}>
        {t("plan.home.invite")} <span aria-hidden="true">{arrows.next}</span>
      </span>
      <span className={styles.inviteText}>{t("plan.home.inviteText")}</span>
    </Link>
  );
}
