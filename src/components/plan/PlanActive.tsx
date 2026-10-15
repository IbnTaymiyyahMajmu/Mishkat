"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchVerse } from "@/lib/quran/api";
import { juzOf, minutesFor, pagesIn } from "@/lib/quran/khatm";
import { ENOUGH, beginNow, dayOffset, rebalance, standing, type Plan } from "@/lib/store/plan";
import { addDays, ayahKey, dayKey, forgetRead, noteRead, type ReadingLog } from "@/lib/store/reading";
import { useSettings } from "@/lib/store/settings";
import { useLocale } from "@/lib/i18n";
import { KhatmRing } from "./KhatmRing";
import { PlanHero } from "./PlanHero";
import { usePlanWords } from "./words";
import styles from "./Plan.module.css";

/**
 * A plan under way: where the reader is in it, what to read now, and every
 * day of it.
 *
 * What to read now is the first portion not yet read — today's, or an
 * earlier day's still waiting, or tomorrow's when today's is done. Falling
 * behind is said plainly and once, with the one thing that helps: spreading
 * what is left over the days left, so the reading still ends when it was
 * meant to.
 */

/** Around today, the days shown before the reader asks for all of them. */
const BEFORE = 2;
const AFTER = 5;

/** The first words of an ayah, as a portion is known by its opening — enough to recognise it on a printed page. */
function opening(text: string): string {
  const out: string[] = [];
  for (const token of text.split(/\s+/)) {
    if (!token) continue;
    out.push(token);
    if (out.filter((w) => /[\u0621-\u064A]/.test(w)).length >= 5) break;
  }
  return out.join(" ");
}

function useOpening(index: number): string | null {
  const { settings } = useSettings();
  const [held, setHeld] = useState<{ index: number; text: string } | null>(null);
  useEffect(() => {
    if (!index) return;
    let alive = true;
    fetchVerse(ayahKey(index), settings.translationId).then((v) => {
      if (alive && v?.text_uthmani) setHeld({ index, text: opening(v.text_uthmani) });
    });
    return () => {
      alive = false;
    };
  }, [index, settings.translationId]);
  return held?.index === index ? held.text : null;
}

export function PlanActive({
  plan,
  log,
  onPlan,
  onChange,
}: {
  plan: Plan;
  log: ReadingLog;
  onPlan: (plan: Plan) => void;
  onChange: () => void;
}) {
  const { t, rich, n } = useLocale();
  const words = usePlanWords();
  const now = dayKey();
  const s = useMemo(() => standing(plan, log, now), [plan, log, now]);
  const { portions, today } = s;
  const [all, setAll] = useState(false);
  const [asking, setAsking] = useState(false);
  const [marked, setMarked] = useState<{ indexes: number[]; day: string } | null>(null);

  const waiting = today < 0;
  // Days are numbered through the whole reading, across any respreading of it.
  const offset = dayOffset(plan);
  const over = !waiting && today >= portions.length && !s.complete;
  const at = Math.min(s.current, portions.length - 1);
  const portion = portions[at];
  const unread = useMemo(() => {
    const out: number[] = [];
    if (portion) for (let i = portion.from; i <= portion.to; i++) if (!s.readSet.has(i)) out.push(i);
    return out;
  }, [portion, s.readSet]);
  const openingWords = useOpening(portion?.from ?? 0);

  const total = portions.reduce((sum, p) => sum + p.words, 0);
  const readWords = portions.reduce((sum, p, i) => sum + Math.min(1, s.read[i]) * p.words, 0);
  const percent = total ? Math.floor((readWords / total) * 100) : 0;
  const ends = addDays(plan.cycle.start, plan.cycle.days - 1);
  const last = plan.done[plan.done.length - 1];
  const finishedToday = last?.day === now;

  const daysLeft = portions.length - Math.max(0, today);
  const spreadPages = daysLeft > 0 && s.next ? Math.max(1, Math.round(pagesIn(s.next, 6236) / daysLeft)) : 0;

  // ── the head ──
  const status = waiting
    ? t("plan.beginsTomorrow")
    : over
      ? t("plan.overLede", { count: portions.length - s.finished, countText: n(portions.length - s.finished) })
      : `${
          s.lead > 0
            ? t("plan.ahead", { count: s.lead, countText: n(s.lead) })
            : s.lead < 0
              ? t("plan.behind", { count: -s.lead, countText: n(-s.lead) })
              : t("plan.onPace")
        } ${t("plan.endsOn", { date: words.longDay(ends) })}`;

  // The day a reading is finished, the ring is the reading finished — all of
  // it gold — and not the next one, empty, waiting for tomorrow.
  const ring =
    waiting && finishedToday ? (
      <KhatmRing portions={portions} from={1} done label={t("plan.ring.label")}>
        <span className={styles.centreBig}>{`${n(100)}%`}</span>
        <span className={styles.centreSmall}>{t("plan.ring.read")}</span>
      </KhatmRing>
    ) : (
      <KhatmRing
        portions={portions}
        read={s.read}
        today={waiting ? -1 : Math.min(today, portions.length - 1)}
        from={plan.cycle.from}
        bead={s.next}
        done={s.complete}
        label={t("plan.ring.label")}
      >
        <span className={styles.centreBig}>{`${n(percent)}%`}</span>
        <span className={styles.centreSmall}>{t("plan.ring.read")}</span>
        {s.next > 0 && <span className={styles.centreNote}>{t("plan.ring.juz", { n: n(juzOf(s.next)) })}</span>}
      </KhatmRing>
    );

  // ── the portion to read now ──
  const kicker =
    s.current < today
      ? t("plan.today.behindKicker", { n: n(offset + s.current + 1) })
      : s.current > today
        ? t("plan.today.aheadKicker", { n: n(offset + s.current + 1) })
        : t("plan.today.kicker");
  const firstUnread = unread[0] ?? portion?.from ?? 1;
  const progress = portion ? Math.min(1, s.read[at]) : 0;

  const mark = () => {
    if (!unread.length) return;
    noteRead(unread);
    setMarked({ indexes: unread, day: dayKey() });
  };

  // ── the days ──
  const centre = Math.max(0, Math.min(portions.length - 1, waiting ? 0 : Math.min(s.current, Math.max(0, today))));
  const shown = all ? portions : portions.slice(Math.max(0, centre - BEFORE), centre + AFTER + 1);

  return (
    <>
      <PlanHero
        kicker={`${t("plan.kicker")} · ${t("plan.reading", { n: n(waiting ? plan.done.length : plan.cycle.number) })}`}
        title={
          waiting
            ? t("plan.titleTomorrow")
            : over
              ? t("plan.titleOver")
              : t("plan.dayOf", { day: n(offset + today + 1), days: n(offset + portions.length) })
        }
        ring={ring}
      >
        <p className={styles.lede}>{status}</p>
      </PlanHero>

      <div className={styles.body}>
        {finishedToday && (
          <section className={styles.khatm} aria-live="polite">
            <div aria-hidden="true" className={styles.khatmRays} />
            <p className={styles.khatmTitle}>{t("plan.finished.title")}</p>
            <p className={styles.khatmText}>
              {t("plan.finished.text", { count: last.days, countText: n(last.days), n: n(plan.done.length) })}
            </p>
            {waiting && (
              <p className={styles.khatmText}>
                {t("plan.beginsTomorrow")}{" "}
                <button type="button" className="btn btn-primary" onClick={() => onPlan(beginNow(plan, log, now))}>
                  {t("plan.beginNow")}
                </button>
              </p>
            )}
          </section>
        )}

        {!waiting && portion && !s.complete && (
          <section className={styles.today}>
            <div className={styles.todayMain}>
              <span className="kicker">{kicker}</span>
              {s.current > today && today >= 0 && <p className={styles.todayDone}>{t("plan.today.done")}</p>}
              <h2 className={styles.todayRange}>{words.range(portion.from, portion.to)}</h2>
              <p className={styles.todayMeta}>
                {[
                  t("plan.pages", { count: pagesIn(portion.from, portion.to), countText: n(pagesIn(portion.from, portion.to)) }),
                  t("plan.sum.minutes", { count: minutesFor(portion.words), countText: n(minutesFor(portion.words)) }),
                  words.closes(portion),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p lang="ar" dir="rtl" className={styles.opening} aria-label={t("plan.today.opening")}>
                {openingWords ? `${openingWords} …` : " "}
              </p>
              <div className={styles.progress}>
                <span className={styles.progressTrack}>
                  <span className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
                </span>
                <span className={styles.progressText}>{t("plan.today.percent", { percent: n(Math.floor(progress * 100)) })}</span>
              </div>
            </div>
            <div className={styles.todayActions}>
              <Link href={words.href(firstUnread)} className={`btn btn-primary ${styles.go}`}>
                {t(progress > 0 ? "plan.today.continue" : "plan.today.start", { place: words.place(firstUnread) })}
              </Link>
              <p className={styles.markLine}>
                {t("plan.today.mushaf")}{" "}
                <button type="button" className="btn btn-ghost" onClick={mark} disabled={!unread.length}>
                  {t("plan.today.mark")}
                </button>
              </p>
            </div>
          </section>
        )}

        {marked && (
          <p className={styles.marked} role="status">
            {t("plan.today.marked")}{" "}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                forgetRead(marked.indexes, marked.day);
                setMarked(null);
              }}
            >
              {t("plan.today.undo")}
            </button>
          </p>
        )}

        {!waiting && !over && s.lead < 0 && (
          <section className={styles.notice}>
            <p className={styles.noticeTitle}>{t("plan.catch.title", { count: -s.lead, countText: n(-s.lead) })}</p>
            <p className={styles.noticeText}>{t("plan.catch.text")}</p>
            {daysLeft >= 2 && s.next > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => onPlan(rebalance(plan, s.next, now))}>
                {t("plan.catch.spread", { count: daysLeft, countText: n(daysLeft), pages: n(spreadPages) })}
              </button>
            )}
          </section>
        )}

        {over && (
          <section className={styles.notice}>
            <p className={styles.noticeTitle}>{t("plan.titleOver")}</p>
            <p className={styles.noticeText}>
              {t("plan.overLede", { count: portions.length - s.finished, countText: n(portions.length - s.finished) })}
            </p>
            <button type="button" className="btn btn-primary" onClick={onChange}>
              {t("plan.over.again")}
            </button>
          </section>
        )}

        <section className={styles.days}>
          <h2 className={styles.sectionTitle}>{t("plan.days.title")}</h2>
          <ol className={styles.dayList}>
            {shown.map((p) => {
              const r = s.read[p.day];
              const done = r >= ENOUGH;
              const isToday = p.day === today;
              return (
                <li key={p.day}>
                  <Link
                    href={words.href(p.from)}
                    className={`${styles.dayRow} ${done ? styles.dayDone : ""} ${isToday ? styles.dayToday : ""}`}
                    aria-current={isToday ? "date" : undefined}
                  >
                    <span className={styles.dayMark} aria-hidden="true">
                      {done ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      ) : (
                        <span className={styles.dayPie} style={{ "--p": `${Math.round(r * 100)}%` } as React.CSSProperties} />
                      )}
                    </span>
                    <span className={styles.dayNumber}>{t("plan.day", { n: n(offset + p.day + 1) })}</span>
                    <span className={styles.dayDate}>{isToday ? t("plan.days.today") : words.day(addDays(plan.cycle.start, p.day))}</span>
                    <span className={styles.dayRange}>{words.range(p.from, p.to)}</span>
                    <span className={styles.dayMeta}>
                      {done
                        ? t("plan.days.read")
                        : r > 0
                          ? t("plan.today.percent", { percent: n(Math.floor(r * 100)) })
                          : t("plan.pages", { count: pagesIn(p.from, p.to), countText: n(pagesIn(p.from, p.to)) })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          {portions.length > shown.length || all ? (
            <button type="button" className="btn btn-ghost" onClick={() => setAll(!all)}>
              {all ? t("plan.days.fewer") : t("plan.days.all", { count: portions.length, countText: n(portions.length) })}
            </button>
          ) : null}
        </section>

        {plan.done.length > 0 && (
          <section className={styles.history}>
            <h2 className={styles.sectionTitle}>{t("plan.history.title")}</h2>
            <ol className={styles.historyList} reversed>
              {[...plan.done].reverse().map((d, i) => (
                <li key={`${d.day}-${i}`}>
                  <span className={styles.historyNumber}>{t("plan.reading", { n: n(plan.done.length - i) })}</span>
                  <span>{t("plan.history.row", { date: words.longDay(d.day), count: d.days, countText: n(d.days) })}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className={styles.controls}>
          <button type="button" className="btn btn-secondary" onClick={onChange}>
            {t("plan.change")}
          </button>
          {asking ? (
            <span className={styles.ask}>
              {t("plan.stopAsk")}{" "}
              <button type="button" className="btn btn-primary" onClick={() => onPlan({ ...plan, closed: now })}>
                {t("plan.stopYes")}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setAsking(false)}>
                {t("plan.stopNo")}
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setAsking(true)}>
              {t("plan.stop")}
            </button>
          )}
        </section>

        <section className={styles.method}>
          <h2 className={styles.methodTitle}>{t("plan.method.title")}</h2>
          <p>{rich("plan.method", { b: (x) => <b>{x}</b> })}</p>
        </section>
      </div>
    </>
  );
}
