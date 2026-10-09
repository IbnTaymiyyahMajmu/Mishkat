"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Evidence, HadithRef, Intro, Passage, Period, Rank } from "@/lib/intros/types";
import { juzStartsIn } from "@/lib/quran/juz";
import { MAKKAN_COUNT, REVELATION_ORDER, SURAH_FACTS } from "@/lib/quran/surahFacts";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { tafsirWork, type TafsirWork } from "@/lib/quran/tafsir";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { ordinal } from "@/lib/text";
import { useDailyAyah } from "../home/useDailyAyah";
import { useTafsirSay } from "../tafsir/useTafsirSay";
import { Shamsa } from "./Shamsa";
import styles from "./SurahIntro.module.css";

/**
 * The introduction to a surah.
 *
 * A reader should come away from this page knowing five things about the
 * surah they are about to open: where it stands — in the muṣḥaf and in the
 * twenty-three years; what was happening when it came down; what it is for;
 * how it is laid out; and what the Prophet ﷺ said of it. The page is those
 * five, in that order, and each is shown as the kind of thing it is:
 *
 *   counted    the figures at the head, the river of the 114 surahs, the
 *              medallion and the strip — all drawn from numbers, none typed;
 *   quoted     the Arabic set in the margin of a claim: a scholar's own
 *              sentence, from the copy of his book this site holds, with the
 *              way to the passage it stands in;
 *   written    the telling. In English, whatever language the site is in —
 *              it is content, like a translation, and not the site's own
 *              words — and credited at the foot of the page.
 *
 * The frontispiece is lit like the landing page, a plate set into the top of
 * the page; below it the page is paper again, and is for reading.
 */

const PERIOD: Record<Period, MessageKey> = {
  "makkah-early": "intro.period.makkahEarly",
  "makkah-middle": "intro.period.makkahMiddle",
  "makkah-late": "intro.period.makkahLate",
  "madinah-early": "intro.period.madinahEarly",
  "madinah-middle": "intro.period.madinahMiddle",
  "madinah-late": "intro.period.madinahLate",
};

const PLACE: Record<"makkah" | "madinah" | "disputed", MessageKey> = {
  makkah: "intro.place.makkah",
  madinah: "intro.place.madinah",
  disputed: "intro.place.disputed",
};

/** How a report stands, in a word or two. */
const RANK: Record<Rank, MessageKey> = {
  agreed: "intro.rank.agreed",
  sahih: "intro.rank.sahih",
  hasan: "intro.rank.hasan",
  companion: "intro.rank.companion",
  disputed: "intro.rank.disputed",
  reported: "intro.rank.reported",
};

/**
 * What is said beside a report that is not ṣaḥīḥ. A reader should never have
 * to work out for himself that what he is reading is a degree weaker than the
 * line above it; so the page says it, in a sentence, where the report is.
 */
const NOTED: Partial<Record<Rank, MessageKey>> = {
  hasan: "intro.rank.note.hasan",
  companion: "intro.rank.note.companion",
  disputed: "intro.rank.note.disputed",
  reported: "intro.rank.note.reported",
};

/**
 * The works an introduction is written from, oldest first, and how a line in
 * its list of sources names each. The page shows them as books — title, author
 * and date — and not as a line of text.
 */
const WORKS: [id: string, named: RegExp][] = [
  ["tabari", /^al-Ṭabarī/],
  ["baghawi", /^al-Baghawī/],
  ["zad-almaseer", /^Ibn al-Jawzī/],
  ["qurtubi", /^al-Qurṭubī/],
  ["ibn-alqayyim", /^Ibn al-Qayyim/],
  ["ibn-katheer", /^Ibn Kathīr/],
  ["aldur-almanthoor", /^al-Suyūṭī/],
  ["fath-alqadeer", /^al-Shawkānī/],
  ["adwaa-albayan", /^al-Shinqīṭī/],
  ["ibn-uthaymeen", /^Ibn ʿUthaymīn/],
  ["mukhtasar", /^al-Mukhtaṣar/],
];

/**
 * Works quoted for what they transmit and for nothing else. Each quotation
 * from one says so under it, and Sources says why.
 */
const REPORTS_ONLY = new Set(["qurtubi"]);

/** A gatherer of reports who does not grade them; neither does the page, and it says so. */
const UNGRADED = new Set(["aldur-almanthoor"]);

/** What the copy wraps a phrase in, and a quotation taken from inside it does not want. */
const BRACKETS = "«»“”()[]" + String.fromCharCode(34);

/** The collections sunnah.com numbers the way the scholars cite them. */
const LOOKUP = new Set(["bukhari", "muslim", "tirmidhi", "abudawud", "nasai", "ibnmajah"]);

interface Props {
  surah: number;
  /** The written introduction, or null where there is none yet. */
  intro: Intro | null;
  /** al-Mukhtaṣar's statement of the surah's aim, in its own Arabic. */
  aimArabic: string;
  ayahWords: number[];
}

interface Stop {
  id: string;
  label: string;
}

export function SurahIntro({ surah, intro, aimArabic, ayahWords }: Props) {
  const { t, n, arrows, locale } = useLocale();
  const names = useSurahNames();
  const say = useTafsirSay();
  const facts = SURAH_FACTS[surah - 1];
  const baked = SURAH_NAMES[surah - 1];
  const name = names.name(surah);
  const [active, setActive] = useState(-1);

  const passages = useMemo(() => intro?.outline ?? [], [intro]);
  const totalWords = facts.words || 1;
  const wordsIn = useMemo(() => {
    const sums: number[] = [0];
    for (const w of ayahWords) sums.push(sums[sums.length - 1] + w);
    return (p: Passage) => (sums[p.to] ?? 0) - (sums[p.from - 1] ?? 0);
  }, [ayahWords]);

  // The books behind the page: every one it quotes, and every one its own
  // list of sources names. What is left of that list is what is not a tafsir —
  // the collections of hadith, the sīrah.
  const { works, others } = useMemo(() => {
    if (!intro) return { works: [] as TafsirWork[], others: [] as string[] };
    const quoted = new Set<string>([
      "mukhtasar",
      ...intro.revelation.evidence.map((e) => e.work),
      ...(intro.revelation.attested ?? []).map((e) => e.work),
      ...intro.occasions.flatMap((o) => (o.evidence ? [o.evidence.work] : [])),
      ...intro.virtues.flatMap((v) => (v.evidence ? [v.evidence.work] : [])),
    ]);
    return {
      works: WORKS.filter(([id, named]) => quoted.has(id) || intro.sources.some((s) => named.test(s)))
        .map(([id]) => tafsirWork(`app:${id}`))
        .filter((w): w is TafsirWork => !!w),
      others: intro.sources.filter((s) => !WORKS.some(([, named]) => named.test(s))),
    };
  }, [intro]);

  // Which marks of standing the account of the surah carries, for the key under it.
  const marks = useMemo(() => {
    const told = intro ? [intro.revelation.detail, ...intro.setting].join(" ") : "";
    return MARKED.filter((rank) => told.includes(`{${rank}}`));
  }, [intro]);

  const juz = useMemo(() => juzStartsIn(surah), [surah]);
  const place = intro?.revelation.place ?? facts.place;
  const range = (from: number, to: number) =>
    from === to ? t("common.ayahN", { n: from }) : t("common.ayahRange", { from, to });

  const stops: Stop[] = [
    { id: "opening", label: t("intro.stop.opening") },
    { id: "revelation", label: t("intro.stop.revelation") },
    { id: "aim", label: t("intro.stop.aim") },
    ...(passages.length ? [{ id: "map", label: t("intro.stop.map") }] : []),
    ...(intro ? [{ id: "narrated", label: t("intro.stop.narrated") }] : []),
    ...(intro?.names.length ? [{ id: "names", label: t("intro.stop.names") }] : []),
    { id: "neighbours", label: t("intro.stop.neighbours") },
    ...(intro ? [{ id: "sources", label: t("intro.stop.sources") }] : []),
  ];
  const here = useHere(stops.map((s) => s.id));
  const rail = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  useReveal(page, surah);

  // On a narrow screen the rail lies down and scrolls sideways, and the stop
  // the reader has reached may be off its edge. Bring it to the middle.
  useEffect(() => {
    const strip = rail.current;
    const on = strip?.querySelector<HTMLElement>("[aria-current]");
    if (!strip || !on || strip.scrollWidth <= strip.clientWidth) return;
    const a = on.getBoundingClientRect();
    const b = strip.getBoundingClientRect();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({
      left: strip.scrollLeft + (a.left - b.left) - (b.width - a.width) / 2,
      behavior: still ? "auto" : "smooth",
    });
  }, [here]);

  const picked = active >= 0 ? passages[active] : undefined;
  const extras = [
    facts.pages[0] === facts.pages[1]
      ? t("intro.fact.page", { n: facts.pages[0] })
      : t("intro.fact.pages", { from: facts.pages[0], to: facts.pages[1] }),
    t("intro.fact.ruku", { count: facts.ruku }),
    ...facts.sajdah.map((ayah) => t("intro.fact.sajdah", { n: ayah })),
  ];

  return (
    <div className={`page-shell ${styles.shell}`} ref={page}>
      <div className={styles.progress} aria-hidden="true" />
      {/* ── the frontispiece ───────────────────────────────────────────── */}
      <header id="opening" className={styles.hero}>
        <div className={styles.motes} aria-hidden="true" />
        <div className={styles.heroInner}>
          <Link href={`/read/${surah}/`} className={styles.back}>
            {arrows.prev} {t("intro.back", { surah: name })}
          </Link>
          <div className={styles.heroText}>
            <div className={styles.kicker}>{t("intro.kicker", { n: surah })}</div>
            <h1 className={`${styles.name} ${names.arabic ? styles.nameArabic : ""}`}>{name}</h1>
            {names.meaning(surah) && <div className={styles.meaning}>{names.meaning(surah)}</div>}

            {intro ? (
              <div lang="en" dir="ltr" className={styles.written}>
                <p className={styles.epithet}>{intro.epithet}</p>
                <p className={styles.lede}>{intro.lede}</p>
              </div>
            ) : (
              <p className={styles.lede}>{t("intro.unwritten")}</p>
            )}

            <dl className={styles.facts}>
              <Fact label={t("intro.fact.mushaf")} value={t("intro.fact.ofAll", { n: surah })} />
              <Fact label={t("intro.fact.revealed")} value={ordinal(facts.revealed, locale)} />
              <Fact label={t("intro.fact.where")} value={t(PLACE[place])} />
              <Fact label={t("intro.fact.ayat")} value={n(facts.ayat)} />
              <Fact label={t("intro.fact.words")} value={n(facts.words)} />
              <Fact
                label={t("intro.fact.juz")}
                value={facts.juz[0] === facts.juz[1] ? n(facts.juz[0]) : `${n(facts.juz[0])}–${n(facts.juz[1])}`}
              />
            </dl>
            <p className={styles.extras}>
              {extras.join(" · ")}
              {facts.letters && (
                <>
                  {" · "}
                  {t("intro.fact.letters")}{" "}
                  <span lang="ar" dir="rtl" className={styles.letters}>
                    {facts.letters}
                  </span>
                </>
              )}
            </p>

            <div className={styles.heroActions}>
              <Link href={`/read/${surah}/`} className={styles.begin}>
                {t("intro.begin")} {arrows.next}
              </Link>
              <a href="#revelation" className={styles.down}>
                {t("intro.readOn")}
              </a>
            </div>
          </div>

          <figure className={styles.medallion}>
            <Shamsa
              name={baked?.arabic ?? ""}
              ayahWords={ayahWords}
              passages={passages}
              juz={juz.map((j) => j.ayah)}
              sajdah={facts.sajdah}
              active={active}
              onActive={setActive}
              label={(p) => `${range(p.from, p.to)}, ${p.title}`}
              title={t("intro.wheel.title")}
            />
            <figcaption className={styles.caption} aria-live="polite">
              {picked ? (
                <>
                  <span className={styles.captionRange}>{range(picked.from, picked.to)}</span>
                  <span lang="en" dir="ltr" className={styles.captionTitle}>
                    {picked.title}
                  </span>
                  <a href={`#passage-${picked.from}`} className={styles.captionGo}>
                    {t("intro.wheel.go")} ↓
                  </a>
                </>
              ) : (
                <span className={styles.captionHint}>
                  {t(passages.length ? "intro.wheel.hint" : "intro.wheel.hintBlank")}
                </span>
              )}
            </figcaption>
          </figure>
        </div>
      </header>

      <div className={styles.layout}>
        {/* ── the rail ─────────────────────────────────────────────────── */}
        <nav className={styles.rail} aria-label={t("intro.onPage")}>
          <div className={styles.railInner} ref={rail}>
            <div className="kicker kicker-sm" style={{ marginBottom: 10 }}>
              {t("intro.onPage")}
            </div>
            {stops.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`${styles.railLink} ${here === s.id ? styles.railOn : ""}`}
                aria-current={here === s.id ? "location" : undefined}
              >
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        <article className={styles.body}>
          {/* ── where and when ─────────────────────────────────────────── */}
          <section id="revelation" className={styles.section} data-reveal="head">
            <div className="kicker">{t("intro.revelation.kicker")}</div>
            {intro ? (
              <div lang="en" dir="ltr" className={styles.written}>
                <h2 className={styles.title}>{intro.revelation.verdict}</h2>
                <p className={styles.when}>
                  <Prose text={intro.revelation.when} />
                </p>
              </div>
            ) : (
              <h2 className={styles.title}>{t(PLACE[facts.place])}</h2>
            )}

            <River surah={surah} period={intro ? t(PERIOD[intro.revelation.period]) : ""} />

            {intro && (
              <>
                <div lang="en" dir="ltr" className={styles.written}>
                  <p className={styles.prose}>
                    <Prose text={intro.revelation.detail} />
                  </p>
                </div>
                {intro.revelation.evidence.map((e, i) => (
                  <Quoted key={i} surah={surah} evidence={e} />
                ))}
                {intro.revelation.attested && intro.revelation.attested.length > 0 && (
                  <Attested surah={surah} items={intro.revelation.attested} />
                )}

                <h3 className={styles.subtitle}>{t("intro.setting.title")}</h3>
                <div lang="en" dir="ltr" className={`${styles.written} ${styles.telling}`} data-reveal="prose">
                  {intro.setting.map((para, i) => (
                    <p key={i} className={styles.prose}>
                      <Prose text={para} />
                    </p>
                  ))}
                </div>
                {marks.length > 0 && (
                  <ul id="marks" className={styles.marksKey}>
                    {marks.map((rank) => (
                      <li key={rank}>
                        <span className={styles.mark} aria-hidden="true">
                          {GLYPH[rank]}
                        </span>
                        <span className={styles.marksWord}>{t(RANK[rank])}</span>
                        <span>{t(NOTED[rank] ?? RANK[rank])}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {intro.occasions.length > 0 && (
                  <>
                    <h3 className={styles.subtitle}>{t("intro.occasions.title")}</h3>
                    <div>
                      {intro.occasions.map((o, i) => (
                        <div key={i} className={styles.occasion} data-reveal="item">
                          <div className={styles.occasionWhere}>
                            {o.ayat ? (
                              <Link href={`/read/${surah}/#${surah}:${o.ayat[0]}`}>{range(o.ayat[0], o.ayat[1])}</Link>
                            ) : (
                              t("intro.occasions.whole")
                            )}
                          </div>
                          <div lang="en" dir="ltr" className={styles.written}>
                            <h4 className={styles.occasionTitle}>{o.title}</h4>
                            <div className={o.story ? styles.account : undefined}>
                              <p className={styles.prose}>
                                <Prose text={o.text} />
                              </p>
                              {o.story?.map((para, k) => (
                                <p key={k} className={styles.prose}>
                                  <Prose text={para} />
                                </p>
                              ))}
                            </div>
                            <p className={styles.attribution}>{o.source}</p>
                          </div>
                          <Standing rank={o.rank} caveat={o.caveat} />
                          {o.evidence && <Quoted surah={surah} evidence={o.evidence} />}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </section>

          {/* ── what it is for ─────────────────────────────────────────── */}
          <section id="aim" className={`${styles.section} ${styles.aim}`} data-reveal="aim">
            <div className="kicker">{t("intro.aim.kicker")}</div>
            <p lang="ar" dir="rtl" className={styles.aimArabic}>
              {aimArabic}
            </p>
            {intro && (
              <p lang="en" dir="ltr" className={styles.aimEnglish}>
                {intro.aim}
              </p>
            )}
            <p className={styles.aimCredit}>
              <Link href={`/tafsir/?v=${surah}:1&w=app:mukhtasar`}>{t("intro.aim.credit")}</Link>
            </p>
            {intro && (
              <ul lang="en" dir="ltr" className={styles.themes} aria-label={t("intro.aim.themes")} data-reveal="list">
                {intro.themes.map((theme) => (
                  <li key={theme} className="tag tag-accent">
                    {theme}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── passage by passage ─────────────────────────────────────── */}
          {passages.length > 0 && (
            <section id="map" className={styles.section} data-reveal="head">
              <div className="kicker">{t("intro.map.kicker")}</div>
              <h2 className={styles.title}>{t("intro.map.title")}</h2>

              <div className={styles.strip} role="presentation" data-reveal="strip">
                {passages.map((p, i) => (
                  <a
                    key={p.from}
                    href={`#passage-${p.from}`}
                    tabIndex={-1}
                    aria-hidden="true"
                    title={`${range(p.from, p.to)} · ${p.title}`}
                    className={`${styles.stripPart} ${i % 2 ? styles.stripOdd : ""} ${active === i ? styles.stripOn : ""}`}
                    style={{ flexGrow: Math.max(1, wordsIn(p)), "--i": i } as CSSProperties}
                    onMouseEnter={() => setActive(i)}
                  />
                ))}
              </div>
              <div className={styles.stripEnds}>
                <span>{t("common.ayahN", { n: 1 })}</span>
                <span>{t("common.ayahN", { n: facts.ayat })}</span>
              </div>

              <ol className={styles.passages}>
                {passages.map((p, i) => {
                  const share = Math.round((wordsIn(p) / totalWords) * 100);
                  return (
                    <li
                      key={p.from}
                      id={`passage-${p.from}`}
                      className={`${styles.passage} ${active === i ? styles.passageOn : ""}`}
                      data-reveal="item"
                      onMouseEnter={() => setActive(i)}
                    >
                      <div className={styles.passageWhere}>
                        <span className={styles.passageRange}>
                          {p.from === p.to ? n(p.from) : `${n(p.from)}–${n(p.to)}`}
                        </span>
                        <span className={styles.passageShare}>
                          {t("intro.map.share", { count: p.to - p.from + 1, percent: Math.max(1, share) })}
                        </span>
                      </div>
                      <div className={styles.passageText}>
                        <div lang="en" dir="ltr" className={styles.written}>
                          <h3 className={styles.passageTitle}>{p.title}</h3>
                          <p className={styles.prose}>
                            <Prose text={p.summary} />
                          </p>
                        </div>
                        <Link href={`/read/${surah}/#${surah}:${p.from}`} className={styles.passageRead}>
                          {t("intro.map.read", { n: p.from })} {arrows.next}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className={styles.note}>{t("intro.map.note")}</p>
            </section>
          )}

          {intro?.keyAyah && <KeyAyah surah={surah} ayah={intro.keyAyah.ayah} why={intro.keyAyah.why} />}

          {/* ── what is narrated ───────────────────────────────────────── */}
          {intro && (
            <section id="narrated" className={styles.section} data-reveal="head">
              <div className="kicker">{t("intro.narrated.kicker")}</div>
              <h2 className={styles.title}>{t("intro.narrated.title")}</h2>

              {intro.virtues.length === 0 && <p className={styles.note}>{t("intro.narrated.none")}</p>}
              <div className={styles.narrations}>
                {intro.virtues.map((v, i) => (
                  <figure key={i} className={styles.narration} data-reveal="item">
                    {v.arabic && (
                      <p lang="ar" dir="rtl" className={styles.narrationArabic}>
                        {v.arabic}
                      </p>
                    )}
                    <blockquote lang="en" dir="ltr" className={styles.narrationText}>
                      {v.text}
                    </blockquote>
                    <figcaption className={styles.narrationFoot}>
                      <span lang="en" dir="ltr" className={styles.narrationSource}>
                        {[v.narrator && t("intro.narrated.from", { name: v.narrator }), v.source].filter(Boolean).join(" · ")}
                      </span>
                      <span
                        lang="en"
                        dir="ltr"
                        className={`${v.grade.length > 34 ? styles.gradeLong : styles.grade} ${NOTED[v.rank] ? styles.gradeSoft : ""} ${v.caveat ? styles.flagged : ""}`}
                        title={v.rank === "sahih" ? t("intro.rank.note.sahih") : undefined}
                      >
                        {v.grade}
                        {v.caveat && <Doubt reason={v.caveat} written grading />}
                      </span>
                      {lookups(v.refs).map((ref) => (
                        <a
                          key={`${ref.book}:${ref.number}`}
                          href={`https://sunnah.com/${ref.book}:${ref.number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.lookup}
                        >
                          {t("intro.narrated.look", { ref: `${ref.book}:${ref.number}` })} ↗
                        </a>
                      ))}
                    </figcaption>
                    {NOTED[v.rank] && <Standing rank={v.rank} />}
                    {v.evidence && <Quoted surah={surah} evidence={v.evidence} />}
                  </figure>
                ))}
              </div>

              {intro.virtuesNote && (
                <aside className={styles.caution} data-reveal="item">
                  <div className="kicker kicker-sm">{t("intro.narrated.caution")}</div>
                  <p lang="en" dir="ltr" className={styles.prose}>
                    {intro.virtuesNote}
                  </p>
                </aside>
              )}
            </section>
          )}

          {/* ── its names ──────────────────────────────────────────────── */}
          {intro && intro.names.length > 0 && (
            <section id="names" className={styles.section} data-reveal="head">
              <div className="kicker">{t("intro.names.kicker")}</div>
              <h2 className={styles.title}>{t("intro.names.title", { count: intro.names.length })}</h2>
              <div className={styles.names}>
                {intro.names.map((item) => (
                  <div key={item.arabic} className={styles.nameCard} data-reveal="item">
                    <div lang="ar" dir="rtl" className={styles.nameArabicBig}>
                      {item.arabic}
                    </div>
                    <div lang="en" dir="ltr" className={styles.written}>
                      <div className={styles.nameLatin}>{item.name}</div>
                      <div className={styles.nameMeaning}>{item.meaning}</div>
                      {item.note && (
                        <p className={styles.nameNote}>
                          <Prose text={item.note} />
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── before and after ───────────────────────────────────────── */}
          <section id="neighbours" className={styles.section} data-reveal="head">
            <div className="kicker">{t("intro.neighbours.kicker")}</div>
            <h2 className={styles.title}>{t("intro.neighbours.title")}</h2>
            <div className={styles.neighbours} data-reveal="list">
              {surah > 1 && (
                <Neighbour
                  surah={surah - 1}
                  label={t("intro.neighbours.before")}
                  arrow={arrows.prev}
                  text={intro?.before}
                />
              )}
              {surah < 114 && (
                <Neighbour
                  surah={surah + 1}
                  label={t("intro.neighbours.after")}
                  arrow={arrows.next}
                  text={intro?.after}
                  end
                />
              )}
            </div>

            {intro && intro.notable.length > 0 && (
              <>
                <h3 className={styles.subtitle}>{t("intro.notable.title")}</h3>
                <ul className={styles.notable} data-reveal="list">
                  {intro.notable.map((item) => (
                    <li key={item.ayah}>
                      <Link href={`/read/${surah}/#${surah}:${item.ayah}`} className={styles.notableLink}>
                        <span className={styles.notableKey}>
                          {surah}:{item.ayah}
                          {item.to ? `–${item.to}` : ""}
                        </span>
                        <span lang="en" dir="ltr" className={styles.notableLabel}>
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* ── sources ────────────────────────────────────────────────── */}
          {intro && (
            <section id="sources" className={`${styles.section} ${styles.sources}`} data-reveal="head">
              <div className="kicker">{t("intro.sources.kicker")}</div>
              <h2 className={styles.title}>{t("intro.sources.title")}</h2>
              <p className={styles.prose}>{t("intro.sources.method")}</p>

              <h3 className={styles.subtitle}>{t("intro.sources.quoted")}</h3>
              <ul className={styles.works} data-reveal="list">
                {works.map((work, i) => (
                  <li key={work.id} style={{ "--i": i } as CSSProperties}>
                    <Link href={`/tafsir/?v=${surah}:1&w=${work.id}`} className={styles.work}>
                      {say.arabic(work) && (
                        <span lang="ar" dir="rtl" className={styles.workArabic}>
                          {say.arabic(work)}
                        </span>
                      )}
                      <span className={styles.workName}>{say.name(work)}</span>
                      <span className={styles.workBy}>{say.credit(work)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className={styles.note}>{t("intro.sources.only")}</p>
              {works.some((work) => REPORTS_ONLY.has(work.id.replace("app:", ""))) && (
                <p id="on-reports" className={`${styles.note} ${styles.noteMarked}`}>
                  {t("intro.sources.qurtubi")}
                </p>
              )}
              <p className={styles.note}>{t("intro.sources.grades")}</p>

              {others.length > 0 && (
                <>
                  <h3 className={styles.subtitle}>{t("intro.sources.also")}</h3>
                  <ul lang="en" dir="ltr" className={styles.sourceList}>
                    {others.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className={styles.note}>{t("intro.river.note")}</p>
            </section>
          )}

          {/* ── on into the surah ──────────────────────────────────────── */}
          <footer className={styles.end} data-reveal="end">
            <div lang="ar" dir="rtl" className={styles.endArabic} aria-hidden="true">
              {baked?.arabic}
            </div>
            <Link href={`/read/${surah}/`} className={`btn btn-primary ${styles.endBegin}`}>
              {t("intro.end.read", { surah: name })} {arrows.next}
            </Link>
            <div className={styles.endMore}>
              <Link href={`/read/${surah}/mushaf/`} className="btn btn-ghost">
                {t("reader.mushafView")}
              </Link>
              <Link href={`/tafsir/?v=${surah}:1`} className="btn btn-ghost">
                {t("intro.end.tafsir")}
              </Link>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}

// ── the pieces ──────────────────────────────────────────────────────────────

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * The 114 surahs in the order they began to come down, each a bar as tall as
 * the surah is long, with this one lit.
 *
 * It answers "where does this stand" at a glance, and it answers it honestly:
 * what is drawn is an order, not a calendar. The one date on it is the one
 * that is certain — the Hijrah, which falls between the eighty-sixth surah and
 * the eighty-seventh.
 */
function River({ surah, period }: { surah: number; period: string }) {
  const { t, locale, arrows } = useLocale();
  const names = useSurahNames();
  const [peek, setPeek] = useState(0);

  const order = SURAH_FACTS[surah - 1].revealed;
  const tallest = useMemo(() => Math.max(...SURAH_FACTS.map((f) => Math.sqrt(f.words))), []);
  const shown = peek || surah;
  const shownFacts = SURAH_FACTS[shown - 1];
  const before = REVELATION_ORDER[order - 2];
  const after = REVELATION_ORDER[order];

  return (
    <div className={styles.river} data-reveal="river">
      <div className={styles.riverHead}>
        <span>
          {t("intro.river.here", { order: ordinal(order, locale) })}
          <Doubt reason={t("intro.river.note")} />
          {period && (
            <>
              {" · "}
              {period}
              <Doubt reason={t("intro.period.doubt")} />
            </>
          )}
        </span>
      </div>

      <div
        className={styles.riverBars}
        role="img"
        aria-label={t("intro.river.label", { order })}
        onMouseLeave={() => setPeek(0)}
      >
        {REVELATION_ORDER.map((id, index) => {
          const f = SURAH_FACTS[id - 1];
          const height = 12 + 88 * (Math.sqrt(f.words) / tallest);
          return (
            <Link
              key={id}
              href={`/read/${id}/about/`}
              tabIndex={-1}
              aria-hidden="true"
              className={[
                styles.bar,
                f.place === "madinah" ? styles.barMadinah : "",
                id === surah ? styles.barHere : "",
                id === peek ? styles.barPeek : "",
              ].join(" ")}
              style={{ height: `${height}%`, "--i": index } as CSSProperties}
              onMouseEnter={() => setPeek(id)}
            />
          );
        })}
        <span className={styles.hijrah} style={{ insetInlineStart: `${(MAKKAN_COUNT / 114) * 100}%` }} aria-hidden="true">
          <span>{t("intro.river.hijrah")}</span>
        </span>
      </div>

      <div className={styles.riverAxis} aria-hidden="true">
        <span style={{ flexGrow: MAKKAN_COUNT }}>{t("intro.river.makkah", { count: MAKKAN_COUNT })}</span>
        <span style={{ flexGrow: 114 - MAKKAN_COUNT }}>{t("intro.river.madinah", { count: 114 - MAKKAN_COUNT })}</span>
      </div>

      <div className={styles.riverRead} aria-hidden={peek ? undefined : true}>
        {peek ? (
          <>
            {ordinal(shownFacts.revealed, locale)} · {names.name(shown)} ·{" "}
            {t(shownFacts.place === "makkah" ? "intro.place.makkah" : "intro.place.madinah")}
          </>
        ) : (
          " "
        )}
      </div>

      <div className={styles.riverNext}>
        {before ? (
          <Link href={`/read/${before}/about/`} className={styles.riverLink}>
            <span className={styles.riverLinkLabel}>
              {arrows.prev} {t("intro.river.after")}
            </span>
            <span className={names.arabic ? "surah-ar" : undefined}>{names.name(before)}</span>
          </Link>
        ) : (
          <span className={styles.riverEdge}>{t("intro.river.firstOfAll")}</span>
        )}
        {after ? (
          <Link href={`/read/${after}/about/`} className={`${styles.riverLink} ${styles.riverLinkEnd}`}>
            <span className={styles.riverLinkLabel}>
              {t("intro.river.before")} {arrows.next}
            </span>
            <span className={names.arabic ? "surah-ar" : undefined}>{names.name(after)}</span>
          </Link>
        ) : (
          <span className={`${styles.riverEdge} ${styles.riverLinkEnd}`}>{t("intro.river.lastOfAll")}</span>
        )}
      </div>
    </div>
  );
}

/** A scholar's sentence, in his Arabic, with the way to where he says it. */
function Quoted({ surah, evidence }: { surah: number; evidence: Evidence }) {
  const { t, arrows } = useLocale();
  const say = useTafsirSay();
  const work = tafsirWork(`app:${evidence.work}`);
  // The copy keeps its editors' quotation marks, which open and close in
  // different places from where a quotation here begins and ends.
  const words = evidence.quote.replace(/["«»“”]/g, "").replace(/\s+/g, " ").trim();

  return (
    <figure className={styles.quoted} data-reveal="quote">
      <blockquote lang="ar" dir="rtl" className={styles.quotedText}>
        {words}
      </blockquote>
      <figcaption className={styles.quotedBy}>
        {work ? (
          <>
            <span>{say.credit(work)}</span>
            <span className={styles.quotedWork}>{say.name(work)}</span>
            {REPORTS_ONLY.has(evidence.work) && (
              <a href="#on-reports" className={styles.quotedNote}>
                {t("intro.evidence.reportsOnly")}
              </a>
            )}
            <Link href={`/tafsir/?v=${surah}:${evidence.ayah}&w=${work.id}`} className={styles.quotedLink}>
              {t("intro.evidence.read")} {arrows.next}
            </Link>
          </>
        ) : (
          evidence.work
        )}
      </figcaption>
    </figure>
  );
}

/**
 * How a report stands, set under it: a word for its standing, and — where it
 * is anything less than ṣaḥīḥ — a sentence saying what that means.
 */
function Standing({ rank, caveat }: { rank: Rank; caveat?: string }) {
  const { t } = useLocale();
  const note = NOTED[rank];

  return (
    <p className={`${styles.standing} ${note ? styles.standingSoft : ""}`}>
      <span
        className={`${styles.standingMark} ${caveat ? styles.flagged : ""}`}
        title={rank === "sahih" ? t("intro.rank.note.sahih") : undefined}
      >
        {t(RANK[rank])}
      </span>
      {caveat && <Doubt reason={caveat} written grading />}
      {note && <span className={styles.standingNote}>{t(note)}</span>}
    </p>
  );
}

/**
 * The same finding as other works record it. A row to a work: who wrote it,
 * what he says in a line of English, and under that his own words.
 */
function Attested({ surah, items }: { surah: number; items: Evidence[] }) {
  const { t, arrows } = useLocale();
  const say = useTafsirSay();

  return (
    <div className={styles.attested} data-reveal="list">
      <h3 className={styles.attestedTitle}>{t("intro.attested.title")}</h3>
      <ul className={styles.attestedList}>
        {items.map((e, i) => {
          const work = tafsirWork(`app:${e.work}`);
          const words = [...e.quote]
            .filter((c) => !BRACKETS.includes(c))
            .join("")
            .split(" ")
            .filter(Boolean)
            .join(" ");
          return (
            <li key={i} className={styles.attestedRow} style={{ "--i": i } as CSSProperties}>
              <div className={styles.attestedWho}>
                <span className={styles.attestedAuthor}>{work ? say.short(work) : e.work}</span>
                {work && <span className={styles.attestedWork}>{say.name(work)}</span>}
              </div>
              <div>
                {e.says && (
                  <p lang="en" dir="ltr" className={styles.attestedSays}>
                    <Prose text={e.says} />
                  </p>
                )}
                <p lang="ar" dir="rtl" className={styles.attestedQuote}>
                  {words}
                </p>
                {UNGRADED.has(e.work) && <p className={styles.attestedCaveat}>{t("intro.attested.ungraded")}</p>}
              </div>
              {work && (
                <Link
                  href={`/tafsir/?v=${surah}:${e.ayah}&w=${work.id}`}
                  className={styles.attestedLink}
                  aria-label={`${t("intro.evidence.read")} — ${say.short(work)}`}
                  title={t("intro.evidence.read")}
                >
                  {arrows.next}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.attestedNote}>{t("intro.attested.note")}</p>
    </div>
  );
}

/** One ayah of the surah, in the reader's own translation, and why this one. */
function KeyAyah({ surah, ayah, why }: { surah: number; ayah: number; why: string }) {
  const { t, arrows } = useLocale();
  const key = `${surah}:${ayah}`;
  const verse = useDailyAyah(key);

  return (
    <aside className={styles.keyAyah} data-reveal="key">
      <div className="kicker">{t("intro.key.kicker")}</div>
      {verse && !verse.failed && (
        <>
          <p lang="ar" dir="rtl" className={`quran ${styles.keyArabic}`}>
            {verse.arabic}
          </p>
          <p dir="auto" className={styles.keyTranslation}>
            {verse.translation}
          </p>
        </>
      )}
      <p lang="en" dir="ltr" className={styles.keyWhy}>
        {why}
      </p>
      <Link href={`/read/${surah}/#${key}`} className={styles.keyLink}>
        {key}
        {verse?.translator ? ` · ${verse.translator}` : ""} · {t("intro.key.open")} {arrows.next}
      </Link>
    </aside>
  );
}

function Neighbour({
  surah,
  label,
  arrow,
  text,
  end,
}: {
  surah: number;
  label: string;
  arrow: string;
  text?: string;
  end?: boolean;
}) {
  const { t } = useLocale();
  const names = useSurahNames();
  return (
    <Link href={`/read/${surah}/about/`} className={`${styles.neighbour} ${end ? styles.neighbourEnd : ""}`}>
      <span className={styles.neighbourLabel}>
        {end ? `${label} ${arrow}` : `${arrow} ${label}`}
      </span>
      <span className={styles.neighbourName}>
        <span className={names.arabic ? "surah-ar" : undefined}>{names.name(surah)}</span>
        {!names.arabic && (
          <span lang="ar" dir="rtl" className={styles.neighbourArabic}>
            {SURAH_NAMES[surah - 1]?.arabic}
          </span>
        )}
      </span>
      {text && (
        <span lang="en" dir="ltr" className={styles.neighbourText}>
          {text}
        </span>
      )}
      <span className={styles.neighbourOpen}>{t("intro.neighbours.open")}</span>
    </Link>
  );
}

/** The references a reader can be sent to: those in the collections sunnah.com numbers as cited. */
function lookups(refs: HadithRef[] | undefined): HadithRef[] {
  return (refs ?? []).filter((ref) => LOOKUP.has(ref.book));
}

/** `18:23`, or `18:23–24`, wherever it stands in a sentence. */
const AYAH = /(?<![\d:.])(\d{1,3}):(\d{1,3})(?:[–-](\d{1,3}))?(?![\d:])/g;

/**
 * `{reported}` at the end of a sentence in the writing: the report that
 * sentence tells of is not ṣaḥīḥ, and this is how it stands. It is printed as
 * a small mark, and the key under the account says what each mark means.
 */
const MARK = /[{](hasan|disputed|reported|[?][^}]+)[}]/g;
const MARKED: Rank[] = ["hasan", "disputed", "reported"];
const GLYPH: Partial<Record<Rank, string>> = { hasan: "○", disputed: "◈", reported: "◇" };

/**
 * A written paragraph, with every ayah it names made into the way to that
 * ayah, and every mark of a report's standing set in its place. The writing
 * says "(18:23)"; the reader should be able to go and look.
 */
function Prose({ text }: { text: string }) {
  const { t } = useLocale();
  const out: ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(MARK)) {
    const from = m.index ?? 0;
    if (from > at) out.push(<Linked key={at} text={text.slice(at, from)} />);
    at = from + m[0].length;
    // `{?why}` — a date or a figure that is not certain, and the reason.
    if (m[1].startsWith("?")) {
      out.push(<Doubt key={`d${from}`} reason={m[1].slice(1)} written />);
      continue;
    }
    const rank = m[1] as Rank;
    out.push(
      <a key={`m${from}`} href="#marks" className={styles.mark} title={t(NOTED[rank] ?? RANK[rank])} aria-label={t(RANK[rank])}>
        {GLYPH[rank]}
      </a>,
    );
  }
  if (at < text.length) out.push(<Linked key={at} text={text.slice(at)} />);
  return <Fragment>{out}</Fragment>;
}

/**
 * A small sign after something that is not certain — a date, a figure, a
 * placing — which says why to whoever rests on it. The reason is on the page
 * for a pointer that hovers, a finger that touches and a reader that tabs;
 * it is never only a tooltip the browser may or may not show.
 */
function Doubt({ reason, written, grading }: { reason: string; written?: boolean; grading?: boolean }) {
  const { t } = useLocale();
  return (
    <span
      className={styles.doubt}
      tabIndex={0}
      role="note"
      aria-label={`${t(grading ? "intro.caveat.label" : "intro.doubt.label")}: ${reason}`}
    >
      <span aria-hidden="true">?</span>
      <span className={styles.doubtWhy} lang={written ? "en" : undefined} dir={written ? "ltr" : undefined} aria-hidden="true">
        {reason}
      </span>
    </span>
  );
}

function Linked({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(AYAH)) {
    const from = m.index ?? 0;
    const s = Number(m[1]);
    const a = Number(m[2]);
    if (s < 1 || s > 114 || a < 1 || a > SURAH_FACTS[s - 1].ayat) continue;
    if (from > at) out.push(text.slice(at, from));
    out.push(
      <Link key={from} href={`/read/${s}/#${s}:${a}`} className={styles.ayahRef}>
        {m[0]}
      </Link>,
    );
    at = from + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return <Fragment>{out}</Fragment>;
}

/**
 * Lets the page arrive as it is read. Whatever is marked `data-reveal` waits
 * below the fold and takes its place when it is scrolled to, once; the CSS
 * says how each kind comes in.
 *
 * Nothing waits unless this has run: the mark means something only under
 * `data-live`, which is set here. So a reader without script, or one who has
 * asked for less motion, is simply given the page.
 */
function useReveal(root: { current: HTMLElement | null }, key: number) {
  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const waiting = [...el.querySelectorAll<HTMLElement>("[data-reveal]")];
    // What is already on the screen is not made to wait for it.
    const fold = window.innerHeight * 0.94;
    for (const node of waiting) if (node.getBoundingClientRect().top < fold) node.setAttribute("data-seen", "");
    el.setAttribute("data-live", "");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-seen", "");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -7% 0px" },
    );
    for (const node of waiting) if (!node.hasAttribute("data-seen")) io.observe(node);

    return () => {
      io.disconnect();
      el.removeAttribute("data-live");
      for (const node of waiting) node.removeAttribute("data-seen");
    };
  }, [root, key]);
}

/**
 * Which section the reader is in, so the rail can say so. A band across the
 * upper part of the screen is watched rather than the whole of it, so the
 * answer changes when a heading reaches reading height.
 */
function useHere(ids: string[]): string {
  const [here, setHere] = useState("");
  const key = ids.join("|");

  useEffect(() => {
    const targets = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;

    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = targets.find((target) => seen.get(target.id));
        if (first) setHere(first.id);
      },
      { rootMargin: "-72px 0px -55% 0px", threshold: 0 },
    );
    for (const target of targets) io.observe(target);
    return () => io.disconnect();
  }, [key]);

  return here;
}
