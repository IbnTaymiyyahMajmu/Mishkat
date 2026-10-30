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
const FIRST_YEAR = 100;
const LAST_YEAR = 1450;

/** The names on the line: how wide a letter is at the size they are set, how
   far apart two must stand to be read slanting, at what slant, and how high the
   hairline from a pin rises before its name begins. */
const CHAR = 6.4;
const GAP = 16;
const SLANT_RAD = (58 * Math.PI) / 180;
const LEADER = 24;

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
 * order of the list is itself the history: Qatāda first, the rest in the
 * order they wrote, each leaning on the ones before. The works of our own day
 * written by committees, or by authors still living, have no death to place
 * them by, and are kept apart at the foot rather than given a date they do not
 * have. Or the list can be set out by shelf instead, as tafsir.app shelves the
 * works and as the library is arranged everywhere else on the site.
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
  // The list is the history, century by century — or the shelves, as the
  // library is arranged everywhere else on the site.
  const [arrange, setArrange] = useState<"century" | "shelf">("century");
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

  // Some fifty authors on one line, and a dozen of them in the century after
  // al-Ṭabarī: set flat, their names would need a dozen rows. So the names are
  // set as a historian's chart sets them, slanting up from the line, and where
  // two pins stand too close for their names to be told apart the names are
  // eased apart along the line, each joined to its own pin by a hairline. The
  // order along the line is never changed, so a name is always between its
  // neighbours' names, as its author lived between theirs.
  const laid = useMemo(() => {
    const none = { height: 0, items: [] as { p: Point; label: string; x: number; x2: number; anchor: number }[] };
    if (!width) return none;
    const at = (year: number) => ((year - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * width;
    const run = (label: string) => label.length * CHAR + 6;
    const items = points
      .map((p) => {
        // Named as the Arabic work is, where it is here in two languages.
        const label = say.short(p.works.find((w) => w.lang === "ar") ?? p.works[0]);
        const x = at(p.when.from);
        const x2 = at(p.when.to);
        return { p, label, x, x2, anchor: (x + x2) / 2 };
      })
      .sort((a, b) => a.anchor - b.anchor);
    // Eased apart going forward, then drawn back from the far end, where a
    // name slanting off the edge of the line would leave the page.
    for (let i = 1; i < items.length; i++) items[i].anchor = Math.max(items[i].anchor, items[i - 1].anchor + GAP);
    let limit = Infinity;
    for (let i = items.length - 1; i >= 0; i--) {
      const room = width - run(items[i].label) * Math.cos(SLANT_RAD);
      items[i].anchor = Math.max(0, Math.min(items[i].anchor, room, limit - GAP));
      limit = items[i].anchor;
    }
    const longest = Math.max(0, ...items.map((item) => run(item.label)));
    return { height: Math.ceil(LEADER + longest * Math.sin(SLANT_RAD) + 22), items };
  }, [points, width, say]);

  const lineHeight = Math.max(laid.height, 60);

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
          {/* The hairlines from each pin to its name, drawn in the line's own
              terms and turned over with it on a page read right to left. */}
          {width > 0 && (
            <svg className={styles.leaders} width={width} height={lineHeight} aria-hidden="true">
              {laid.items.map(({ p, x, x2, anchor }) => (
                <line
                  key={p.key}
                  className={pointShown(p) ? "" : styles.pointDim}
                  x1={(x + x2) / 2}
                  y1={lineHeight - 8}
                  x2={anchor}
                  y2={lineHeight - 4 - LEADER}
                />
              ))}
            </svg>
          )}
          {width > 0 &&
            laid.items.map(({ p, x, x2, anchor, label }) => (
              <div key={p.key} className={`${styles.point} ${pointShown(p) ? "" : styles.pointDim}`}>
                {x2 > x + 1 && <span className={styles.span} style={{ insetInlineStart: x, width: x2 - x }} />}
                <span className={styles.pin} style={{ insetInlineStart: x }} />
                {x2 > x + 1 && <span className={styles.pin} style={{ insetInlineStart: x2 }} />}
                <button
                  tabIndex={-1}
                  className={styles.pointLabel}
                  style={{ insetInlineStart: anchor, bottom: 4 + LEADER }}
                  onClick={() => reveal((p.works.find(shown) ?? p.works[0]).id)}
                  title={`${label} — ${say.era(p.works[0])}`}
                >
                  {label}
                </button>
              </div>
            ))}
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

      {/* ── the works, century by century or shelf by shelf ─────────── */}
      <div className={styles.arrange} role="tablist" aria-label={t("library.arrange")}>
        {(["century", "shelf"] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={arrange === id}
            className={`${styles.arrangeOption} ${arrange === id ? styles.arrangeOn : ""}`}
            onClick={() => setArrange(id)}
          >
            {t(id === "century" ? "library.byCentury" : "library.byShelf")}
          </button>
        ))}
      </div>

      <div className={styles.list} ref={listRef}>
        {arrange === "shelf" &&
          say.shelves
            .filter((shelf) => lang === "all" || shelf.lang === lang)
            .map((shelf) => (
              <div key={shelf.id} className={styles.shelf}>
                {lang === "all" && (
                  <h3 className={styles.shelfTitle}>{t("tafsir.in", { language: say.language(shelf.lang) })}</h3>
                )}
                {shelf.sections.map((section) => (
                  <section key={section.id} className={styles.century}>
                    <h4 className={styles.centuryTitle}>
                      {say.section(section)}
                      {section.titleArabic && (
                        <span className={styles.sectionArabic} dir="rtl" lang="ar">
                          {section.titleArabic}
                        </span>
                      )}
                    </h4>
                    {section.works.map((work) => (
                      <WorkCard
                        key={work.id}
                        work={work}
                        when={whenOf(work)}
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
                ))}
              </div>
            ))}
        {arrange === "century" && centuries.map(({ century, rows }) => {
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
