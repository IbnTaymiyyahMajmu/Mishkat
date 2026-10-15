"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useDailyAyah } from "../home/useDailyAyah";
import { dateOf } from "../plan/words";
import { ENOUGH } from "@/lib/store/plan";
import { dayKey, useReadingLog } from "@/lib/store/reading";
import { lightOf, weeks, type Stage } from "@/lib/store/light";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { NicheScene } from "./NicheScene";
import styles from "./Niche.module.css";

/**
 * The reader's niche: `/niche/`.
 *
 * The page a reader comes back to see. It opens on their niche, with the
 * tiles lit since they last looked kindling as it loads, and under it what
 * the niche is made of: the ayah it is taken from, the thirty medallions,
 * the days.
 */

const noSubscription = () => () => {};

export const STAGE: Record<Stage, MessageKey> = {
  unlit: "niche.stage.unlit",
  spark: "niche.stage.spark",
  flame: "niche.stage.flame",
  lamp: "niche.stage.lamp",
  niche: "niche.stage.niche",
  full: "niche.stage.full",
  radiant: "niche.stage.radiant",
};

/** How many days the reader had seen lit last time, kept as a convenience: lost, the page simply kindles nothing. */
const SEEN = "mishkat.niche.seen.v1";

function useFresh(lit: number, ready: boolean): { fresh: number; first: boolean } {
  // Read once, as the page first renders in the browser, and held: days read
  // during the visit are new against it too, and kindle as they arrive.
  const [before] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(SEEN);
      const value = raw === null ? NaN : Number(raw);
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(SEEN, String(lit));
      } catch {
        /* nothing kept; the next visit kindles them again */
      }
    }, 2500);
    return () => clearTimeout(id);
  }, [ready, lit]);
  // A first visit lights the niche up before the reader's eyes; after that, only what is new.
  return before === null ? { fresh: Math.min(lit, 40), first: true } : { fresh: Math.max(0, lit - before), first: false };
}

/** How much was read on a day, as one of five depths of gold. */
function level(count: number): number {
  if (!count) return 0;
  if (count < 10) return 1;
  if (count < 50) return 2;
  if (count < 150) return 3;
  return 4;
}

export function NichePage() {
  const ready = useSyncExternalStore(noSubscription, () => true, () => false);
  const log = useReadingLog();
  const now = dayKey();
  const light = useMemo(() => lightOf(log, now), [log, now]);
  const { t, n, info } = useLocale();
  const names = useSurahNames();
  const { fresh, first } = useFresh(light.lit, ready);
  const ayah = useDailyAyah("24:35");

  const longDay = useMemo(
    () => new Intl.DateTimeFormat(info.dates, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    [info.dates],
  );
  const dayTitle = (day: string) =>
    t("niche.dayTitle", {
      date: longDay.format(dateOf(day)),
      count: light.perDay.get(day) ?? 0,
      countText: n(light.perDay.get(day) ?? 0),
    });
  const juzTitle = (j: number) =>
    light.juz[j - 1] >= ENOUGH
      ? t("niche.juzDone", { n: n(j) })
      : t("niche.juzPart", { n: n(j), percent: n(Math.floor(light.juz[j - 1] * 100)) });
  const grid = useMemo(() => weeks(now, 26), [now]);

  const status =
    light.since < 0
      ? t("niche.status.none")
      : light.since === 0
        ? t("niche.status.today")
        : light.since === 1
          ? t("niche.status.yesterday")
          : t("niche.status.waiting", { count: light.since, countText: n(light.since) });

  const label = t("niche.label", {
    stage: t(STAGE[light.stage]),
    days: t("niche.days", { count: light.lit, countText: n(light.lit) }),
    gilded: t("niche.gildedOf", { n: n(light.gilded) }),
  });

  return (
    <div className={`page-shell ${styles.shell}`}>
      <section className={styles.hero}>
        <div aria-hidden="true" className={styles.motes} />
        <div className={styles.heroInner}>
          <span className={styles.kicker}>{t("niche.kicker")}</span>
          <h1 className={styles.title}>{ready ? t(STAGE[light.stage]) : t("niche.title")}</h1>
          <p className={styles.status}>{ready ? status : " "}</p>

          <div className={styles.stage}>
            {ready && <NicheScene light={light} fresh={fresh} label={label} dayTitle={dayTitle} juzTitle={juzTitle} />}
          </div>

          {ready && (
            <dl className={styles.stats}>
              <div>
                <dt>{t("niche.stat.days")}</dt>
                <dd>{n(light.lit)}</dd>
              </div>
              <div>
                <dt>{t("niche.stat.run")}</dt>
                <dd>{n(light.run)}</dd>
              </div>
              <div>
                <dt>{t("niche.stat.gilded")}</dt>
                <dd>
                  {n(light.gilded)}
                  <small>/{n(30)}</small>
                </dd>
              </div>
              <div>
                <dt>{t("niche.stat.lamps")}</dt>
                <dd>{n(light.lamps)}</dd>
              </div>
            </dl>
          )}
          {ready && fresh > 0 && !first && (
            <p className={styles.freshNote}>{t("niche.fresh", { count: fresh, countText: n(fresh) })}</p>
          )}
        </div>
      </section>

      <div className={styles.body}>
        <section className={styles.ayah}>
          <span className="kicker">{`${names.name(24)} 24:35`}</span>
          <p lang="ar" dir="rtl" className={styles.ayahArabic}>
            {ayah?.arabic ?? " "}
          </p>
          {ayah && !ayah.failed && (
            <p className={styles.ayahTranslation} dir="auto">
              {ayah.translation}
              {ayah.translator && <span className={styles.ayahBy}>{` — ${ayah.translator}`}</span>}
            </p>
          )}
          <p className={styles.ayahWhy}>{t("niche.why")}</p>
          <Link href="/read/24/#24:35" className={styles.more}>
            {t("niche.readAyah")}
          </Link>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("niche.thirty.title")}</h2>
          <p className={styles.sectionLede}>{t("niche.thirty.text")}</p>
          <ol className={styles.medallions}>
            {light.juz.map((r, j) => {
              const done = r >= ENOUGH;
              return (
                <li
                  key={j}
                  className={`${styles.medallion} ${done ? styles.medallionDone : r > 0.02 ? styles.medallionPart : ""}`}
                  title={juzTitle(j + 1)}
                  style={{ "--r": `${Math.round(r * 100)}%` } as CSSProperties}
                >
                  <span className={styles.medallionMark} aria-hidden="true" />
                  <span className={styles.medallionNumber}>{n(j + 1)}</span>
                </li>
              );
            })}
          </ol>
          <p className={styles.lampsLine}>
            {light.lamps > 0 ? t("niche.lamps", { count: light.lamps, countText: n(light.lamps) }) : t("niche.lampsNone")}
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("niche.daysTitle")}</h2>
          <p className={styles.sectionLede}>
            {t("niche.run", { count: light.run, countText: n(light.run) })}{" "}
            {t("niche.best", { count: light.best, countText: n(light.best) })}
          </p>
          <div className={styles.calendar} role="img" aria-label={t("niche.daysTitle")}>
            {grid.map((week, w) => (
              <div key={w} className={styles.week}>
                {week.map((day, d) =>
                  day ? (
                    <span
                      key={d}
                      className={`${styles.day} ${styles[`l${level(light.perDay.get(day) ?? 0)}`]} ${day === now ? styles.dayNow : ""}`}
                      title={dayTitle(day)}
                    />
                  ) : (
                    <span key={d} className={styles.dayEmpty} />
                  ),
                )}
              </div>
            ))}
          </div>
          <div className={styles.legend} aria-hidden="true">
            <span>{t("niche.less")}</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className={`${styles.day} ${styles[`l${l}`]}`} />
            ))}
            <span>{t("niche.more")}</span>
          </div>
        </section>

        <figure className={styles.hadith}>
          <blockquote lang="ar" dir="rtl" className={styles.hadithArabic}>
            أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ تَعَالَى أَدْوَمُهَا وَإِنْ قَلَّ
          </blockquote>
          <figcaption>
            <span className={styles.hadithSaid}>{t("niche.hadith")}</span>
            <span className={styles.hadithSource}>{t("niche.hadithSource")}</span>
          </figcaption>
        </figure>

        <section className={styles.method}>
          <h2 className={styles.methodTitle}>{t("niche.method.title")}</h2>
          <p>{t("niche.method")}</p>
          <Link href="/plan/" className={styles.more}>
            {t("niche.toPlan")}
          </Link>
        </section>
      </div>
    </div>
  );
}
