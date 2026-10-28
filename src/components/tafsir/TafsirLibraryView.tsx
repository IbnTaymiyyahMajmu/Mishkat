"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Para } from "@/lib/quran/types";
import { TAFSIR_LIBRARY, type TafsirLang, type TafsirWork } from "@/lib/quran/tafsir";
import { fetchTafsirAppAbout, tafsirAppCoverage } from "@/lib/quran/tafsirApp";
import { tafsirCovers } from "@/lib/quran/tafsirMap";
import { useLocale } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { ordinal } from "@/lib/text";
import { TafsirText } from "./TafsirText";
import { useTafsirSay } from "./useTafsirSay";
import styles from "./TafsirLibraryView.module.css";

/** Every ayah there is, which is what a work's coverage is out of. */
const AYAT = 6236;

/**
 * Ayat a reader is likely to want any work's word on, offered on each work's
 * card: the opening of the Book, the Throne Verse, the ayah of light this site
 * is named from, and the surah said to be a third of the Qurʾan.
 */
const KNOWN = ["1:1", "2:255", "24:35", "112:1"];

/** The line runs from the first century anything here is from to the last. */
const FIRST_YEAR = 300;
const LAST_YEAR = 1450;

interface Props {
  verseKey: string;
  /** The work being read. */
  active?: string;
  /** The works kept among the tabs, and the works being compared. */
  kept: string[];
  compared: string[];
  onRead: (id: string) => void;
  onCompare: (id: string) => void;
  onToggle: (id: string) => void;
}

/** When a work is from, as a year of the hijra or two; null for a committee's. */
interface When {
  from: number;
  to: number;
  /** Worked out from a common-era year, so placed on the line but not printed. */
  reckoned: boolean;
}

function whenOf(work: TafsirWork): When | null {
  const ah = /d\. (\d+)(?: and (\d+))? AH/.exec(work.era);
  if (ah) {
    const from = Number(ah[1]);
    return { from, to: ah[2] ? Number(ah[2]) : from, reckoned: false };
  }
  // A modern author's death is given in the common era. A hijri year is a
  // lunar one, about 32 of them to 31 solar years, counted from 622.
  const ce = /d\. (\d{4})/.exec(work.era);
  if (ce) {
    const year = Math.round(((Number(ce[1]) - 622) * 33) / 32);
    return { from: year, to: year, reckoned: true };
  }
  return null;
}

/** A point on the line: one author's work, in however many languages it is here. */
interface Point {
  key: string;
  label: string;
  when: When;
  works: TafsirWork[];
}

/**
 * The library, set out as a reference shelf: who wrote each work and when he
 * died, what kind of tafsir it is, in which languages it is here, and how much
 * of the Qurʾan it covers — and, for the classical works, what the author said
 * he set out to do and what later scholars said of the result, which this
 * site's copy of tafsir.app carries with each work.
 *
 * The works are placed on a line of the centuries of the hijra, as they would
 * be on a historian's chart, and listed under their centuries, so that the
 * order of the list is itself the history: al-Ṭabarī first, the rest in the
 * order they wrote, each leaning on the ones before. The two works written by
 * committees of our own day have no one death to place them by, and are kept
 * apart at the foot rather than given a date they do not have.
 *
 * Nothing here ranks the works or speaks for them. What a work is said to be
 * is the one line the library gives it everywhere; what is said of it at more
 * length is quoted, and is tafsir.app's.
 */
export function TafsirLibraryView({ verseKey, active, kept, compared, onRead, onCompare, onToggle }: Props) {
  const { t, n, locale } = useLocale();
  const say = useTafsirSay();
  const names = useSurahNames();
  const [lang, setLang] = useState<TafsirLang | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const shown = (w: TafsirWork) => lang === "all" || w.lang === lang;
  // "4th" in English; elsewhere the number, which each language's sentence
  // makes an ordinal of in its own way.
  const nth = (century: number) => (locale === "en" ? ordinal(century, locale) : n(century));

  // ── the works in the order they were written ──────────────────────────────
  const dated = useMemo(
    () =>
      TAFSIR_LIBRARY.map((work, order) => ({ work, when: whenOf(work), order }))
        .sort((a, b) => (a.when?.from ?? 1e9) - (b.when?.from ?? 1e9) || a.order - b.order),
    [],
  );
  const centuries = useMemo(() => {
    const out: { century: number | null; rows: { work: TafsirWork; when: When | null }[] }[] = [];
    for (const row of dated) {
      const century = row.when ? Math.floor(row.when.from / 100) + 1 : null;
      const last = out[out.length - 1];
      if (last && last.century === century) last.rows.push(row);
      else out.push({ century, rows: [row] });
    }
    return out;
  }, [dated]);

  // One point for each work, and one for a work held in two languages.
  const points = useMemo(() => {
    const byKey = new Map<string, Point>();
    for (const { work, when } of dated) {
      if (!when) continue;
      const key = work.family ?? work.id;
      const held = byKey.get(key);
      if (held) held.works.push(work);
      else byKey.set(key, { key, label: "", when, works: [work] });
    }
    return [...byKey.values()];
  }, [dated]);
  // A committee's work, once for each work, whichever languages it is in.
  const unplaced = [...new Map(dated.filter((d) => !d.when).map((d) => [d.work.family ?? d.work.id, d.work])).values()];
  const firstCentury = Math.floor((points[0]?.when.from ?? FIRST_YEAR) / 100) + 1;
  const pointShown = (p: Point) => p.works.some(shown);

  // ── the line, laid out to the width it has ────────────────────────────────
  const lineRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const watch = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const laid = useMemo(() => {
    if (!width) return { rows: 0, items: [] as { p: Point; x: number; x2: number; row: number; label: string; left: number; stem: number }[] };
    const at = (year: number) => ((year - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * width;
    // Each name is set over its own pin, in the lowest of the first two rows
    // where it touches no other. Where the authors crowd — six of them in the
    // last seventy years — that is not to be had, and a name is set instead
    // just before its stem, in the lowest row free there: so a stem never
    // passes through a name, and the later the author the higher his name. Its
    // width is reckoned from its letters, near enough at the size it is set.
    const rows: [number, number][][] = [];
    const free = (row: number, span: [number, number]) =>
      (rows[row] ?? []).every(([a, b]) => span[1] <= a || span[0] >= b);
    const take = (row: number, span: [number, number]) => {
      while (rows.length <= row) rows.push([]);
      rows[row].push(span);
    };
    const items = points.map((p) => {
      // Named as the Arabic work is, where it is here in two languages.
      const label = say.short(p.works.find((w) => w.lang === "ar") ?? p.works[0]);
      const x = at(p.when.from);
      const x2 = at(p.when.to);
      const mid = (x + x2) / 2;
      const size = label.length * 7.1 + 12;
      const over = Math.max(0, Math.min(width - size, mid - size / 2));
      const before = Math.max(0, mid - 5 - size);
      const spanAt = (left: number): [number, number] => [left - 6, left + size + 6];
      for (const row of [0, 1]) {
        if (free(row, spanAt(over))) {
          take(row, spanAt(over));
          return { p, x, x2, row, label, left: over, stem: mid };
        }
      }
      let row = 0;
      while (!free(row, spanAt(before))) row++;
      take(row, spanAt(before));
      return { p, x, x2, row, label, left: before, stem: mid };
    });
    return { rows: rows.length, items };
  }, [points, width, say]);

  const ROW = 25;
  const lineHeight = laid.rows * ROW + 22;

  /** Open a work's card, and bring it into sight. */
  const reveal = (id: string) => {
    setOpen(id);
    requestAnimationFrame(() => {
      const card = listRef.current?.querySelector<HTMLElement>(`[data-work="${CSS.escape(id)}"]`);
      card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  const counts = {
    all: TAFSIR_LIBRARY.length,
    en: TAFSIR_LIBRARY.filter((w) => w.lang === "en").length,
    ar: TAFSIR_LIBRARY.filter((w) => w.lang === "ar").length,
  };

  return (
    <section className={styles.library} aria-label={t("tafsir.view.library")}>
      <header className={styles.head}>
        <h2 className={styles.title}>
          {t("library.title", { count: counts.all, countText: n(counts.all), first: nth(firstCentury) })}
        </h2>
        <p className={styles.lead}>{t("library.lead")}</p>
        <div className={styles.filter} role="tablist" aria-label={t("tafsir.languages")}>
          {(["all", "ar", "en"] as const).map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={lang === id}
              className={`${styles.filterOption} ${lang === id ? styles.filterOn : ""}`}
              onClick={() => setLang(id)}
            >
              {id === "all" ? t("library.all") : say.language(id)}
              <span className={styles.filterCount}>{n(counts[id])}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ── the line ────────────────────────────────────────────────── */}
      <figure className={styles.line} aria-hidden="true">
        <div className={styles.lineBox} ref={lineRef} style={{ height: lineHeight }}>
          {/* The stems and pins first, and every name over them, so that a stem
              passing a name it is not the stem of goes behind it. */}
          {width > 0 &&
            laid.items.map(({ p, x, x2, row, stem }) => {
              const top = (laid.rows - 1 - row) * ROW;
              return (
                <div key={p.key} className={`${styles.point} ${pointShown(p) ? "" : styles.pointDim}`}>
                  <span
                    className={styles.stem}
                    style={{ insetInlineStart: stem, top: top + 10, height: lineHeight - top - 10 - 4 }}
                  />
                  {x2 > x + 1 && <span className={styles.span} style={{ insetInlineStart: x, width: x2 - x }} />}
                  <span className={styles.pin} style={{ insetInlineStart: x }} />
                  {x2 > x + 1 && <span className={styles.pin} style={{ insetInlineStart: x2 }} />}
                </div>
              );
            })}
          {width > 0 &&
            laid.items.map(({ p, row, label, left }) => {
              const top = (laid.rows - 1 - row) * ROW;
              return (
                <div key={p.key} className={`${styles.point} ${pointShown(p) ? "" : styles.pointDim}`}>
                  <button
                    tabIndex={-1}
                    className={styles.pointLabel}
                    style={{ insetInlineStart: left, top }}
                    onClick={() => reveal((p.works.find(shown) ?? p.works[0]).id)}
                    title={`${label} — ${say.era(p.works[0])}`}
                  >
                    {label}
                  </button>
                </div>
              );
            })}
          <span className={styles.axis} />
        </div>
        {/* A mark where each century begins, and its name in the middle of it. */}
        <div className={styles.ticks}>
          {Array.from({ length: Math.ceil((LAST_YEAR - FIRST_YEAR) / 100) }, (_, i) => {
            const from = FIRST_YEAR + i * 100;
            const mid = (from + Math.min(from + 100, LAST_YEAR)) / 2;
            const pct = (year: number) => `${((year - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * 100}%`;
            return (
              <span key={from}>
                <span className={styles.tick} style={{ insetInlineStart: pct(from) }} />
                <span className={styles.tickLabel} style={{ insetInlineStart: pct(mid) }}>
                  {nth(Math.floor(from / 100) + 1)}
                </span>
              </span>
            );
          })}
        </div>
        <figcaption className={styles.caption}>
          <span>{t("library.axis")}</span>
          {unplaced.length > 0 && (
            <span>{t("library.unplaced", { works: unplaced.map((w) => say.short(w)).join(" · ") })}</span>
          )}
        </figcaption>
      </figure>

      {/* ── the works, century by century ───────────────────────────── */}
      <div className={styles.list} ref={listRef}>
        {centuries.map(({ century, rows }) => {
          const visible = rows.filter((r) => shown(r.work));
          if (!visible.length) return null;
          return (
            <section key={century ?? "committees"} className={styles.century}>
              <h3 className={styles.centuryTitle}>
                {century === null
                  ? t("library.committees")
                  : t("library.century", { n: nth(century) })}
              </h3>
              {visible.map(({ work, when }) => (
                <WorkCard
                  key={work.id}
                  work={work}
                  when={when}
                  verseKey={verseKey}
                  open={open === work.id}
                  onOpen={() => setOpen(open === work.id ? null : work.id)}
                  active={active === work.id}
                  kept={kept.includes(work.id)}
                  compared={compared.includes(work.id)}
                  onRead={onRead}
                  onCompare={onCompare}
                  onToggle={onToggle}
                  surahName={names.name}
                />
              ))}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function WorkCard({
  work,
  when,
  verseKey,
  open,
  onOpen,
  active,
  kept,
  compared,
  onRead,
  onCompare,
  onToggle,
  surahName,
}: {
  work: TafsirWork;
  when: When | null;
  verseKey: string;
  open: boolean;
  onOpen: () => void;
  active: boolean;
  kept: boolean;
  compared: boolean;
  onRead: (id: string) => void;
  onCompare: (id: string) => void;
  onToggle: (id: string) => void;
  surahName: (n: number) => string;
}) {
  const { t, n, info } = useLocale();
  const say = useTafsirSay();
  const other = say.counterpart(work);
  // A year is a name for a year, not a count: 1394, never 1,394.
  const year = (value: number) => value.toLocaleString(info.numbers, { useGrouping: false });
  const arabic = say.arabic(work);
  const title = say.title(work);
  const copied = work.id.startsWith("app:") ? work.id.slice(4) : null;
  const ayat = copied ? tafsirAppCoverage(copied) : undefined;
  const place = (key: string) => `${surahName(Number(key.split(":")[0]))} ${key}`;

  // Which of the ayat on offer this work speaks on, asked once it is opened.
  const [covers, setCovers] = useState<{ id: string; keys: Set<string> } | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    tafsirCovers(work, [verseKey, ...KNOWN]).then((keys) => alive && setCovers({ id: `${work.id}|${verseKey}`, keys }));
    return () => {
      alive = false;
    };
  }, [open, work, verseKey]);
  const known = covers?.id === `${work.id}|${verseKey}` ? covers.keys : null;
  const here = known ? known.has(verseKey) : true;

  // What the author set out to do, as tafsir.app quotes him, fetched when asked for.
  const [words, setWords] = useState<Para[] | null | undefined>(undefined);
  const [wordsOpen, setWordsOpen] = useState(false);
  const askWords = () => {
    setWordsOpen((o) => !o);
    if (words !== undefined || !work.aboutId) return;
    setWords(null);
    fetchTafsirAppAbout(work.aboutId)
      .then((paras) => setWords(paras))
      .catch(() => setWords([]));
  };

  return (
    <article className={`${styles.work} ${open ? styles.workOpen : ""} ${active ? styles.workActive : ""}`} data-work={work.id}>
      <button className={styles.workRow} onClick={onOpen} aria-expanded={open}>
        <span className={styles.year}>{when && !when.reckoned ? year(when.from) : ""}</span>
        <span className={styles.workNames}>
          <span className={styles.workTop}>
            <span className={styles.workShort}>{say.short(work)}</span>
            {arabic && (
              <span className={styles.workArabic} dir="rtl" lang="ar">
                {arabic}
              </span>
            )}
          </span>
          <span className={styles.workTitle}>
            {say.name(work)}
            {title && <span className={styles.workMeaning}> — {title}</span>}
          </span>
        </span>
        <span className={styles.workMeta}>
          <span className={styles.kind}>{say.kind(work)}</span>
          <span className={styles.langs}>
            {say.badge(work.lang)}
            {other && <span className={styles.langAlso}> + {say.badge(other.work.lang)}</span>}
          </span>
        </span>
        <svg className={styles.chevron} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={styles.card}>
          <p className={styles.about}>{say.about(work)}</p>
          <dl className={styles.facts}>
            <div>
              <dt>{t("library.by")}</dt>
              <dd>{say.credit(work)}</dd>
            </div>
            <div>
              <dt>{t("library.language")}</dt>
              <dd>
                {say.language(work.lang)}
                {other && (
                  <span className={styles.quiet}>
                    {" · "}
                    {t(other.partial ? "library.alsoPartial" : "library.also", { language: say.language(other.work.lang) })}
                  </span>
                )}
              </dd>
            </div>
            {ayat !== undefined && (
              <div>
                <dt>{t("library.covers")}</dt>
                <dd>
                  <span className={styles.cover} aria-hidden="true">
                    <span className={styles.coverFill} style={{ width: `${(ayat / AYAT) * 100}%` }} />
                  </span>
                  {ayat >= AYAT
                    ? t("library.coversAll")
                    : t("library.coversSome", { count: ayat, countText: n(ayat), total: n(AYAT) })}
                </dd>
              </div>
            )}
          </dl>

          <div className={styles.actions}>
            <button className="btn btn-primary" onClick={() => onRead(work.id)} disabled={!here}>
              {here ? t("library.read", { ref: place(verseKey) }) : t("library.nothingHere", { ref: verseKey })}
            </button>
            <button className="btn btn-secondary" onClick={() => onCompare(work.id)} disabled={!here} aria-pressed={compared}>
              {compared ? t("library.compared") : t("library.compare")}
            </button>
            <button
              className={`${styles.keep} ${kept ? styles.keepOn : ""}`}
              onClick={() => onToggle(work.id)}
              aria-pressed={kept}
              title={t(kept ? "tafsir.keptTitle" : "tafsir.keepTitle")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={kept ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 17v5" />
                <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
              </svg>
              {t(kept ? "library.keptTab" : "library.keepTab")}
            </button>
          </div>

          {known && (
            <div className={styles.readOn}>
              <span className={styles.readOnLabel}>{t("library.readOn")}</span>
              {KNOWN.filter((key) => key !== verseKey && known.has(key)).map((key) => (
                <Link key={key} className={styles.chip} href={`/tafsir/?v=${key}&w=${encodeURIComponent(work.id)}`}>
                  {place(key)}
                </Link>
              ))}
            </div>
          )}

          {work.aboutId && (
            <div className={styles.own}>
              <button className={styles.ownToggle} onClick={askWords} aria-expanded={wordsOpen}>
                {t("library.ownWords")}
              </button>
              {wordsOpen && (
                <div className={styles.ownText}>
                  {words === null && <p className={styles.quiet}>{t("common.fetching")}</p>}
                  {words && words.length > 0 && <TafsirText paras={words} />}
                  {words && words.length === 0 && <p className={styles.quiet}>{t("tafsir.unreached")}</p>}
                  <p className={styles.ownSource}>{t("library.ownSource")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
