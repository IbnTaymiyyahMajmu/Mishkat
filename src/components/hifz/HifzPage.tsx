"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { dateOf } from "../plan/words";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { FIRM, SITTING, bySurah, currentHifz, depth, dueOn, letGo, nextDue, useHifz, type SurahKept } from "@/lib/store/hifz";
import { ayahIndex, dayKey } from "@/lib/store/reading";
import { useSettings } from "@/lib/store/settings";
import { useLocale } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { Sitting } from "./Sitting";
import styles from "./Hifz.module.css";

/**
 * By heart: `/hifz/`.
 *
 * Two things on one address. With nothing asked of it, the page is what the
 * reader keeps: what is due today, a way to begin a passage, and every surah
 * they hold with how firmly each ayah of it is held. Asked for a passage —
 * `?s=67&from=1&to=5` — or for the day's due — `?review=today` — it is a
 * sitting: the ayat one at a time, covered, to be recited and then uncovered.
 *
 * The sitting is in the address so that Back leaves it for the page it was
 * begun from, on a phone as much as anywhere, rather than leaving the site.
 */

const noSubscription = () => () => {};

/** The Prophet's ﷺ words on going back over the Qur'an: al-Bukhārī 5033, as the collection has it. */
const HADITH_AR = "تَعَاهَدُوا الْقُرْآنَ فَوَالَّذِي نَفْسِي بِيَدِهِ لَهُوَ أَشَدُّ تَفَصِّيًا مِنَ الإِبِلِ فِي عُقُلِهَا";

function whole(raw: string | null): number {
  const n = Number(raw);
  return raw !== null && Number.isInteger(n) ? n : 0;
}

export function HifzPage() {
  const ready = useSyncExternalStore(noSubscription, () => true, () => false);
  const params = useSearchParams();
  const review = params.get("review") === "today";
  const surah = whole(params.get("s"));
  const from = whole(params.get("from"));
  const to = whole(params.get("to"));
  const table = SURAH_NAMES[surah - 1];
  const passage = !!table && from >= 1 && to >= from && to <= table.ayat;
  const asked = review ? "today" : passage ? `${surah}:${from}-${to}` : "";

  // What a sitting goes over is settled as it opens and not again: an ayah
  // judged a moment ago must not drop out of the list being walked through.
  const sitting = useMemo(() => {
    if (!ready || !asked) return null;
    const held = currentHifz();
    if (asked === "today") {
      const due = dueOn(held);
      return { queue: due.slice(0, SITTING), fresh: new Set<number>(), more: Math.max(0, due.length - SITTING) };
    }
    const queue: number[] = [];
    const last = Math.min(to, from + SITTING - 1);
    for (let a = from; a <= last; a++) queue.push(ayahIndex(`${surah}:${a}`));
    return { queue, fresh: new Set(queue.filter((i) => !held.has(i))), more: 0 };
  }, [ready, asked, surah, from, to]);

  if (!ready) return <div className={`page-shell ${styles.shell}`} />;
  if (sitting) return <Sitting key={asked} queue={sitting.queue} fresh={sitting.fresh} more={sitting.more} today={asked === "today"} />;
  return <Keeping preset={table ? surah : 0} />;
}

// ── what is kept ────────────────────────────────────────────────────────────

function Keeping({ preset }: { preset: number }) {
  const hifz = useHifz();
  const today = dayKey();
  const { t, n, info, arrows } = useLocale();
  const names = useSurahNames();
  const router = useRouter();

  const due = useMemo(() => dueOn(hifz, today), [hifz, today]);
  const next = useMemo(() => nextDue(hifz, today), [hifz, today]);
  const rows = useMemo(() => bySurah(hifz, today), [hifz, today]);
  const firm = useMemo(() => [...hifz.values()].filter((k) => k.strength >= FIRM).length, [hifz]);

  const day = useMemo(() => new Intl.DateTimeFormat(info.dates, { weekday: "long", day: "numeric", month: "long" }), [info.dates]);

  const status = !hifz.size
    ? t("hifz.status.none")
    : due.length
      ? t("hifz.status.due", { count: due.length, countText: n(due.length) })
      : next
        ? t("hifz.status.next", { date: day.format(dateOf(next)) })
        : t("hifz.status.clear");

  const heading = hifz.size ? t("hifz.head.some") : t("hifz.head.none");

  return (
    <div className={`page-shell ${styles.shell}`}>
      <section className={styles.hero}>
        <div aria-hidden="true" className={styles.motes} />
        <div className={styles.heroInner}>
          <span className={styles.kicker}>{t("hifz.title")}</span>
          <h1 className={`${styles.title} mk-shine`} data-text={heading}>
            {heading}
          </h1>
          <p className={styles.status}>{status}</p>

          {due.length > 0 && (
            <Link href="/hifz/?review=today" className={styles.go}>
              <Flame />
              {t("hifz.reciteDue")} <span aria-hidden="true">{arrows.next}</span>
            </Link>
          )}

          {hifz.size > 0 && (
            <dl className={styles.stats}>
              <div>
                <dt>{t("hifz.stat.kept")}</dt>
                <dd>{n(hifz.size)}</dd>
              </div>
              <div>
                <dt>{t("hifz.stat.firm")}</dt>
                <dd>{n(firm)}</dd>
              </div>
              <div>
                <dt>{t("hifz.stat.due")}</dt>
                <dd>{n(due.length)}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <div className={styles.body}>
        <Begin
          key={preset}
          preset={preset}
          onBegin={(s, a, b) => router.push(`/hifz/?s=${s}&from=${a}&to=${b}`)}
        />

        {rows.length > 0 && (
          <section className={styles.card} aria-labelledby="hifz-kept">
            <header className={styles.cardHead}>
              <h2 id="hifz-kept" className={styles.cardTitle}>
                {t("hifz.kept.title")}
              </h2>
              <span className={styles.legend} aria-hidden="true">
                {t("hifz.legend.new")}
                {[1, 2, 3, 4].map((d) => (
                  <i key={d} data-depth={d} />
                ))}
                {t("hifz.legend.firm")}
              </span>
            </header>
            <ul className={styles.rows}>
              {rows.map((row) => (
                <KeptRow key={row.surah} row={row} name={names.name(row.surah)} arabic={names.arabic} />
              ))}
            </ul>
          </section>
        )}

        <section className={styles.why}>
          <blockquote className={styles.hadith}>
            <p className={styles.hadithAr} lang="ar" dir="rtl">
              {HADITH_AR}
            </p>
            <p>{t("hifz.hadith")}</p>
            <cite>{t("hifz.hadithSource")}</cite>
          </blockquote>
          <h2 className={styles.whyTitle}>{t("hifz.method.title")}</h2>
          <p className={styles.whyText}>{t("hifz.method")}</p>
        </section>
      </div>
    </div>
  );
}

/** Each ayah of a surah as a stretch of one bar, lit by how firmly it is held. */
function strip(row: SurahKept, total: number, rtl: boolean): CSSProperties {
  const lit = ["", "var(--h1)", "var(--h2)", "var(--h3)", "var(--h4)"];
  const stops: string[] = [];
  let at = 0;
  const run = (upTo: number, colour: string) => {
    if (upTo <= at) return;
    stops.push(`${colour} ${(at / total) * 100}% ${(upTo / total) * 100}%`);
    at = upTo;
  };
  for (const { ayah, kept } of row.ayat) {
    run(ayah - 1, "transparent");
    run(ayah, lit[depth(kept.strength)]);
  }
  run(total, "transparent");
  return { backgroundImage: `linear-gradient(to ${rtl ? "left" : "right"}, ${stops.join(", ")})` };
}

function KeptRow({ row, name, arabic }: { row: SurahKept; name: string; arabic: boolean }) {
  const { t, n, rtl } = useLocale();
  const [asking, setAsking] = useState(false);
  const total = SURAH_NAMES[row.surah - 1].ayat;
  const first = row.ayat[0].ayah;
  const last = row.ayat[row.ayat.length - 1].ayah;
  // The stretch that is kept, from its first ayah, as far as one sitting goes.
  const href = `/hifz/?s=${row.surah}&from=${first}&to=${Math.min(last, first + SITTING - 1)}`;

  return (
    <li className={styles.row}>
      <div className={styles.rowHead}>
        <span className={`${styles.rowName} ${arabic ? "surah-ar" : ""}`}>
          <small>{n(row.surah)}</small> {name}
        </span>
        <span className={styles.rowCount}>
          {t("hifz.kept.row", { kept: n(row.ayat.length), total: n(total) })}
          {row.due > 0 && <b> · {t("hifz.kept.due", { count: row.due, countText: n(row.due) })}</b>}
        </span>
      </div>
      <div className={styles.strip} style={strip(row, total, rtl)} role="img" aria-label={t("hifz.kept.row", { kept: n(row.ayat.length), total: n(total) })} />
      <div className={styles.rowActions}>
        {asking ? (
          <>
            <span className={styles.rowAsk}>{t("hifz.kept.forgetSure", { surah: name })}</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                letGo(row.ayat.map((a) => a.index));
                setAsking(false);
              }}
            >
              {t("hifz.kept.forget")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setAsking(false)}>
              {t("common.cancel")}
            </button>
          </>
        ) : (
          <>
            <Link href={href} className="btn btn-primary">
              {t("hifz.kept.recite")}
            </Link>
            <button type="button" className="btn btn-ghost" onClick={() => setAsking(true)}>
              {t("hifz.kept.forget")}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// ── beginning a passage ─────────────────────────────────────────────────────

function Begin({ preset, onBegin }: { preset: number; onBegin: (surah: number, from: number, to: number) => void }) {
  const hifz = useHifz();
  const { lastRead } = useSettings();
  const { t, n } = useLocale();
  const names = useSurahNames();

  /** Where a passage in this surah would begin: its first ayah not yet kept. */
  const opening = (surah: number): [number, number] => {
    const total = SURAH_NAMES[surah - 1].ayat;
    let from = 1;
    while (from <= total && hifz.has(ayahIndex(`${surah}:${from}`))) from++;
    // All of it kept: there is nothing new to begin, so it is offered from its head.
    if (from > total) from = 1;
    // A short surah is taken whole; a long one, five ayat at a time.
    const to = total <= 12 ? total : Math.min(total, from + 4);
    return [from, to];
  };

  const [surah, setSurah] = useState(() => preset || lastRead?.surah || 1);
  const [range, setRange] = useState<[string, string]>(() => {
    const [a, b] = opening(preset || lastRead?.surah || 1);
    return [String(a), String(b)];
  });

  const total = SURAH_NAMES[surah - 1].ayat;
  const from = Number(range[0]);
  const to = Number(range[1]);
  const sound = Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= from && to <= total;
  const count = sound ? to - from + 1 : 0;

  return (
    <section className={styles.card} aria-labelledby="hifz-begin">
      <h2 id="hifz-begin" className={styles.cardTitle}>
        {t("hifz.begin.title")}
      </h2>
      <p className={styles.cardText}>{t("hifz.begin.text")}</p>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (sound) onBegin(surah, from, Math.min(to, from + SITTING - 1));
        }}
      >
        <label className={styles.field}>
          <span>{t("hifz.begin.surah")}</span>
          <select
            className={`input ${names.arabic ? "surah-ar" : ""}`}
            value={surah}
            onChange={(e) => {
              const next = Number(e.target.value);
              setSurah(next);
              const [a, b] = opening(next);
              setRange([String(a), String(b)]);
            }}
          >
            {SURAH_NAMES.map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {n(i + 1)} · {names.name(i + 1)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t("hifz.begin.from")}</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={total}
            value={range[0]}
            onChange={(e) => setRange([e.target.value, range[1]])}
          />
        </label>
        <label className={styles.field}>
          <span>{t("hifz.begin.to")}</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={total}
            value={range[1]}
            onChange={(e) => setRange([range[0], e.target.value])}
          />
        </label>
        <button type="submit" className={styles.go} disabled={!sound}>
          <Flame />
          {t("hifz.begin.go")}
        </button>
      </form>
      <p className={styles.formNote} aria-live="polite">
        {!sound
          ? t("hifz.begin.bad", { total: n(total) })
          : count > SITTING
            ? t("hifz.begin.limit", { n: n(SITTING) })
            : t("common.ayat", { count, countText: n(count) })}
      </p>
    </section>
  );
}

export function Flame() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 1.6c2.6 3 4.4 5.3 4.4 8a4.4 4.4 0 0 1-8.8 0C3.6 6.9 5.4 4.6 8 1.6z" />
      <path d="M2.6 16.4h10.8" />
    </svg>
  );
}
