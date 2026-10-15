"use client";

import { useId, useMemo, useState } from "react";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { juzOf, minutesFor, pagesIn, planPortions } from "@/lib/quran/khatm";
import { LONGEST, SHORTEST, daysFrom, newPlan, paceOf, type Goal, type Plan } from "@/lib/store/plan";
import { addDays, ayahIndex, dayKey, daysBetween } from "@/lib/store/reading";
import { useSettings } from "@/lib/store/settings";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { KhatmRing } from "./KhatmRing";
import { PlanHero } from "./PlanHero";
import { dateOf, usePlanWords } from "./words";
import styles from "./Plan.module.css";

/**
 * Making a plan.
 *
 * The paces offered are the steps of one conversation. ʿAbdullāh ibn ʿAmr
 * was reading the whole Qurʾān every night, and the Prophet ﷺ told him to
 * take a month; each time he said he could manage more he was given the next
 * step — twenty, ten, seven, "and do not go beyond that" (Muslim 1159). In
 * another narration the steps go on to three (al-Bukhārī 1978), and three is
 * the floor: "he has not understood it who recites the Qurʾān in less than
 * three" (Abū Dāwūd 1394, ṣaḥīḥ according to al-Albānī). So the choice is
 * laid out as that conversation, in its words, and nothing here is faster
 * than three days.
 *
 * A pace is a pace: begun at juzʾ 15 at a month's pace, the rest is sixteen
 * days, a juzʾ a day, and the readings after it a month each. A day to finish
 * by is a day — the rest is spread over the days until it, however many.
 */

type Step = { goal: Exclude<Goal, "custom" | "date">; days: number; arabic: string; said: MessageKey; source: MessageKey };

/** The steps as Muslim 1159 gives them. */
const LADDER: Step[] = [
  { goal: "month", days: 30, arabic: "اقْرَإِ الْقُرْآنَ فِي كُلِّ شَهْرٍ", said: "plan.said.month", source: "plan.src.month" },
  { goal: "twenty", days: 20, arabic: "فَاقْرَأْهُ فِي كُلِّ عِشْرِينَ", said: "plan.said.twenty", source: "plan.src.twenty" },
  { goal: "ten", days: 10, arabic: "فَاقْرَأْهُ فِي كُلِّ عَشْرٍ", said: "plan.said.ten", source: "plan.src.ten" },
  {
    goal: "week",
    days: 7,
    arabic: "فَاقْرَأْهُ فِي كُلِّ سَبْعٍ وَلَا تَزِدْ عَلَى ذَلِكَ",
    said: "plan.said.week",
    source: "plan.src.week",
  },
];

/** …and the step al-Bukhārī 1978 goes on to. */
const THREE: Step = { goal: "three", days: 3, arabic: "فِي ثَلَاثٍ", said: "plan.said.three", source: "plan.src.three" };

const REPLY = "إِنِّي أُطِيقُ أَفْضَلَ مِنْ ذَلِكَ";
const FLOOR = "لَا يَفْقَهُ مَنْ قَرَأَ الْقُرْآنَ فِي أَقَلَّ مِنْ ثَلَاثٍ";

const GOAL_NAME: Record<Goal, MessageKey> = {
  month: "plan.goal.month",
  twenty: "plan.goal.twenty",
  ten: "plan.goal.ten",
  week: "plan.goal.week",
  three: "plan.goal.three",
  custom: "plan.goal.custom",
  date: "plan.goal.date",
};

type Start = "fatiha" | "here" | "last" | "choose";

/**
 * Ramadan in the days ahead, by the Umm al-Qurā calendar: whether today is in
 * it, and its first and last days. Nothing at all where the browser has no
 * Hijri calendar.
 */
function ramadanAhead(today: string): { now: boolean; first?: string; last?: string } {
  try {
    const f = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric" });
    const monthOf = (key: string) => Number(f.formatToParts(dateOf(key)).find((p) => p.type === "month")?.value);
    const now = monthOf(today) === 9;
    let first: string | undefined = now ? today : undefined;
    for (let i = 1; i <= LONGEST; i++) {
      const key = addDays(today, i);
      const m = monthOf(key);
      if (m === 9 && !first) first = key;
      if (m !== 9 && first) return { now, first: now ? undefined : first, last: addDays(key, -1) };
    }
    return { now };
  } catch {
    return { now: false };
  }
}

export function Planner({
  previous,
  here,
  onBegin,
  onCancel,
}: {
  /** The plan being changed, or the one that was finished or stopped: its choices are offered again. */
  previous: Plan | null;
  /** The first unread ayah of the reading being changed. */
  here?: number;
  onBegin: (plan: Plan) => void;
  onCancel?: () => void;
}) {
  const { t, rich, n } = useLocale();
  const words = usePlanWords();
  const names = useSurahNames();
  const { lastRead } = useSettings();
  const id = useId();
  const today = useMemo(() => dayKey(), []);
  const ramadan = useMemo(() => ramadanAhead(today), [today]);

  const lastIndex = lastRead ? (lastRead.verseKey ? ayahIndex(lastRead.verseKey) : ayahIndex(`${lastRead.surah}:1`)) : 0;

  const [goal, setGoal] = useState<Goal>(previous?.goal ?? "month");
  const [custom, setCustom] = useState(String(previous?.goal === "custom" ? previous.every : 15));
  const [until, setUntil] = useState(() =>
    previous?.goal === "date" ? addDays(previous.cycle.start, previous.cycle.days - 1) : addDays(today, 29),
  );
  const [start, setStart] = useState<Start>(here && here > 1 ? "here" : "fatiha");
  const [surah, setSurah] = useState(lastRead?.surah ?? 18);
  const [ayah, setAyah] = useState("1");
  const [repeat, setRepeat] = useState(previous?.repeat ?? true);

  const ayat = SURAH_NAMES[surah - 1].ayat;
  const chosenAyah = Math.min(ayat, Math.max(1, Math.round(Number(ayah)) || 1));
  const from =
    start === "here" && here ? here : start === "last" && lastIndex ? lastIndex : start === "choose" ? ayahIndex(`${surah}:${chosenAyah}`) : 1;

  // What the choices come to: how many days this reading takes, how often the
  // ones after it come round, or why there is no plan to show.
  const { days, every, problem } = useMemo((): { days: number; every: number; problem: string | null } => {
    if (goal === "date") {
      const span = daysBetween(today, until) + 1;
      if (!(span >= 1)) return { days: 0, every: 0, problem: t("plan.date.past") };
      if (span > LONGEST) return { days: 0, every: 0, problem: t("plan.date.tooLong", { count: LONGEST }) };
      const pace = paceOf(span, from);
      if (pace < SHORTEST - 0.001) return { days: 0, every: 0, problem: t("plan.date.tooFast") };
      return { days: span, every: Math.min(LONGEST, Math.max(SHORTEST, Math.round(pace))), problem: null };
    }
    const each =
      goal === "custom" ? Math.round(Number(custom)) : ([...LADDER, THREE].find((s) => s.goal === goal)?.days ?? 30);
    if (!(each >= SHORTEST)) return { days: 0, every: 0, problem: t("plan.custom.tooShort") };
    if (each > LONGEST) return { days: 0, every: 0, problem: t("plan.custom.tooLong", { count: LONGEST }) };
    return { days: daysFrom(each, from), every: each, problem: null };
  }, [goal, custom, until, from, today, t]);

  const portions = useMemo(() => (problem || !days ? [] : planPortions(from, 6236, days)), [problem, from, days]);

  const totalPages = pagesIn(from, 6236);
  const perDay = portions.length ? totalPages / portions.length : 0;
  const minutes = portions.length ? minutesFor(portions.reduce((s, p) => s + p.words, 0) / portions.length) : 0;
  // A plan that is so many whole juzʾ a day says so; any other says pages.
  const juzEach = (() => {
    if (!portions.length || portions.some((p) => p.closes !== "juz")) return 0;
    const counts = portions.map((p) => juzOf(p.to) - juzOf(p.from) + 1);
    return counts.every((c) => c === counts[0]) && juzOf(from) === juzOf(portions[0].from) ? counts[0] : 0;
  })();

  const begin = () => {
    if (problem || !portions.length) return;
    onBegin(newPlan(goal, every, from, days, repeat, previous));
  };

  const step = (s: Step) => {
    const on = goal === s.goal;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        className={`${styles.rung} ${on ? styles.rungOn : ""}`}
        onClick={() => setGoal(s.goal)}
      >
        <span className={styles.rungDays}>
          <span className={styles.rungNumber}>{n(s.days)}</span>
          <span className={styles.rungUnit}>{t("plan.unit.days", { count: s.days })}</span>
        </span>
        <span className={styles.rungBody}>
          <span className={styles.rungName}>{t(GOAL_NAME[s.goal])}</span>
          <span lang="ar" dir="rtl" className={styles.rungArabic}>
            {s.arabic}
          </span>
          <span className={styles.rungSaid}>{t(s.said)}</span>
          <span className={styles.rungSource}>{t(s.source)}</span>
        </span>
      </button>
    );
  };

  const reply = (
    <div className={styles.reply}>
      <span lang="ar" dir="rtl" className={styles.replyArabic}>
        {REPLY}
      </span>
      <span className={styles.replySaid}>{t("plan.pace.more")}</span>
    </div>
  );

  const ring = (
    <KhatmRing portions={portions} from={from} bead={problem ? 0 : from} label={t("plan.ring.label")}>
      {problem ? (
        <span className={styles.centreSmall}>—</span>
      ) : (
        <>
          <span className={styles.centreBig}>{n(days)}</span>
          <span className={styles.centreSmall}>{t("plan.unit.days", { count: days })}</span>
          <span className={styles.centreNote}>
            {juzEach
              ? t("plan.ring.juzDay", { count: juzEach })
              : t("plan.ring.pagesDay", { count: Math.round(perDay), countText: n(Math.round(perDay)) })}
          </span>
        </>
      )}
    </KhatmRing>
  );

  const preview = portions.length > 5 ? [...portions.slice(0, 3), null, portions[portions.length - 1]] : portions;

  return (
    <>
      <PlanHero kicker={t("plan.kicker")} title={t("plan.title")} ring={ring}>
        <p className={styles.lede}>{t("plan.lede")}</p>
      </PlanHero>

      <div className={styles.body}>
        <div className={styles.planner}>
          <div className={styles.paces}>
            <h2 className={styles.sectionTitle}>{t("plan.pace.title")}</h2>
            <p className={styles.sectionLede}>{t("plan.pace.intro")}</p>

            <div role="radiogroup" aria-label={t("plan.pace.title")} className={styles.ladder}>
              {LADDER.map((s, i) => (
                <div key={s.goal}>
                  {i > 0 && reply}
                  {step(s)}
                </div>
              ))}
              <div className={styles.other}>{t("plan.pace.other")}</div>
              {step(THREE)}
              <figure className={styles.floor}>
                <blockquote lang="ar" dir="rtl" className={styles.floorArabic}>
                  {FLOOR}
                </blockquote>
                <figcaption>
                  <span className={styles.floorSaid}>{t("plan.floor")}</span>{" "}
                  <span className={styles.rungSource}>{t("plan.src.floor")}</span>
                </figcaption>
              </figure>

              <div className={styles.ownTitle}>{t("plan.pace.own")}</div>
              <div
                className={`${styles.rung} ${styles.rungOwn} ${goal === "custom" ? styles.rungOn : ""}`}
                onClick={() => setGoal("custom")}
              >
                <span className={styles.rungBody}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={goal === "custom"}
                    className={`${styles.rungName} ${styles.rungPick}`}
                    onClick={() => setGoal("custom")}
                  >
                    {t("plan.goal.custom")}
                  </button>
                  <label className={styles.inline}>
                    <span>{t("plan.custom.label")}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={SHORTEST}
                      max={LONGEST}
                      value={custom}
                      onFocus={() => setGoal("custom")}
                      onChange={(e) => {
                        setCustom(e.target.value);
                        setGoal("custom");
                      }}
                      className={`input ${styles.number}`}
                    />
                    <span>{t("plan.unit.days", { count: Math.round(Number(custom)) || 0 })}</span>
                  </label>
                </span>
              </div>

              <div
                className={`${styles.rung} ${styles.rungOwn} ${goal === "date" ? styles.rungOn : ""}`}
                onClick={() => setGoal("date")}
              >
                <span className={styles.rungBody}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={goal === "date"}
                    className={`${styles.rungName} ${styles.rungPick}`}
                    onClick={() => setGoal("date")}
                  >
                    {t("plan.goal.date")}
                  </button>
                  <label className={styles.inline}>
                    <span>{t("plan.date.label")}</span>
                    <input
                      type="date"
                      min={today}
                      max={addDays(today, LONGEST - 1)}
                      value={until}
                      onFocus={() => setGoal("date")}
                      onChange={(e) => {
                        if (e.target.value) setUntil(e.target.value);
                        setGoal("date");
                      }}
                      className={`input ${styles.date}`}
                    />
                  </label>
                  {(ramadan.first || ramadan.last) && (
                    <span className={styles.chips}>
                      {ramadan.first && (
                        <button
                          type="button"
                          className={`${styles.chip} ${goal === "date" && until === addDays(ramadan.first, -1) ? styles.chipOn : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setUntil(addDays(ramadan.first as string, -1));
                            setGoal("date");
                          }}
                        >
                          {t("plan.date.ramadanBefore", { date: words.day(addDays(ramadan.first, -1)) })}
                        </button>
                      )}
                      {ramadan.last && (
                        <button
                          type="button"
                          className={`${styles.chip} ${goal === "date" && until === ramadan.last ? styles.chipOn : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setUntil(ramadan.last as string);
                            setGoal("date");
                          }}
                        >
                          {t("plan.date.ramadanEnd", { date: words.day(ramadan.last) })}
                        </button>
                      )}
                    </span>
                  )}
                  {(ramadan.first || ramadan.last) && <span className={styles.rungSource}>{t("plan.date.ramadanNote")}</span>}
                </span>
              </div>
            </div>
          </div>

          <aside className={styles.side}>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t("plan.start.title")}</h2>
              <div role="radiogroup" aria-label={t("plan.start.title")} className={styles.starts}>
                <label className={styles.option}>
                  <input type="radio" name="start" checked={start === "fatiha"} onChange={() => setStart("fatiha")} />
                  <span>{t("plan.start.fatiha")}</span>
                </label>
                {here && here > 1 && (
                  <label className={styles.option}>
                    <input type="radio" name="start" checked={start === "here"} onChange={() => setStart("here")} />
                    <span>{t("plan.start.here", { place: words.place(here) })}</span>
                  </label>
                )}
                {lastIndex > 1 && lastIndex !== here && (
                  <label className={styles.option}>
                    <input type="radio" name="start" checked={start === "last"} onChange={() => setStart("last")} />
                    <span>{t("plan.start.last", { place: words.place(lastIndex) })}</span>
                  </label>
                )}
                <label className={styles.option}>
                  <input type="radio" name="start" checked={start === "choose"} onChange={() => setStart("choose")} />
                  <span>{t("plan.start.choose")}</span>
                </label>
                {start === "choose" && (
                  <div className={styles.choose}>
                    <div className="field">
                      <label htmlFor={`${id}-surah`}>{t("plan.start.surah")}</label>
                      <select
                        id={`${id}-surah`}
                        className="input"
                        value={surah}
                        onChange={(e) => {
                          setSurah(Number(e.target.value));
                          setAyah("1");
                        }}
                      >
                        {SURAH_NAMES.map((_, i) => (
                          <option key={i} value={i + 1}>
                            {`${i + 1}. ${names.name(i + 1)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`${id}-ayah`}>{t("plan.start.ayah")}</label>
                      <input
                        id={`${id}-ayah`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={ayat}
                        value={ayah}
                        onChange={(e) => setAyah(e.target.value)}
                        className={`input ${styles.number}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <label className={`${styles.option} ${styles.repeat}`}>
                <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
                <span>{t("plan.repeat")}</span>
              </label>
            </section>

            <section className={`${styles.panel} ${styles.summary}`} aria-live="polite">
              <h2 className={styles.panelTitle}>{t("plan.sum.title")}</h2>
              {problem ? (
                <p className={styles.problem}>{problem}</p>
              ) : (
                <>
                  <p className={styles.sumLead}>
                    {from === 1
                      ? t("plan.sum.whole", { count: days, countText: n(days) })
                      : t("plan.sum.rest", { count: days, countText: n(days), place: words.place(from) })}
                  </p>
                  <p className={styles.sumLine}>
                    {t("plan.sum.pages", { count: Math.round(perDay), countText: n(Math.round(perDay)) })}
                    {" · "}
                    {t("plan.sum.minutes", { count: minutes, countText: n(minutes) })}
                  </p>
                  <p className={styles.sumLine}>
                    {rich(
                      "plan.sum.ends",
                      { b: (s) => <b>{s}</b> },
                      { date: words.longDay(addDays(today, days - 1)) },
                    )}
                    {repeat && (from > 1 || goal === "date") && (
                      <> {t("plan.sum.then", { count: every, countText: n(every) })}</>
                    )}
                  </p>

                  <ol className={styles.preview}>
                    {preview.map((p, i) =>
                      p ? (
                        <li key={p.day} className={styles.previewRow}>
                          <span className={styles.previewDay}>{t("plan.day", { n: n(p.day + 1) })}</span>
                          <span className={styles.previewRange}>{words.range(p.from, p.to)}</span>
                          <span className={styles.previewMeta}>
                            {[words.day(addDays(today, p.day)), words.closes(p)].filter(Boolean).join(" · ")}
                          </span>
                        </li>
                      ) : (
                        <li key={`gap${i}`} aria-hidden="true" className={styles.previewGap}>
                          ⋮
                        </li>
                      ),
                    )}
                  </ol>
                </>
              )}

              <div className={styles.actions}>
                <button type="button" className="btn btn-primary" disabled={!!problem} onClick={begin}>
                  {onCancel ? t("plan.beginInstead") : t("plan.begin")}
                </button>
                {onCancel && (
                  <button type="button" className="btn btn-ghost" onClick={onCancel}>
                    {t("plan.cancel")}
                  </button>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
