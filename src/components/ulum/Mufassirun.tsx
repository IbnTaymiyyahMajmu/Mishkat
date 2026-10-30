"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { book, file } from "@/lib/ulum/books";
import { quotedIn } from "@/lib/ulum/read";
import { readJudgements } from "@/lib/ulum/views";
import { useLocale } from "@/lib/i18n";
import { Block, BookText, Chapter, Cite, Silent } from "./Chapter";
import { ar, local, paras, useBook, useNear, type Read, type StudyCtx } from "./study";
import { Differences, Judgement, useViews } from "./Views";
import { whoStyle } from "./who";
import styles from "./AyahStudy.module.css";

/**
 * 08 · The mufassirūn — eleven centuries, side by side, sentence by sentence.
 *
 * Where the scholars differ comes first, as Ibn al-Jawzī and al-Māwardī record
 * it: what they differ on, each view in its colour, and who held it. Al-Ṭabarī's
 * own judgement stands under them, in his words. The page chooses nothing.
 *
 * What a commentator *held* beyond that is a judgement a reader makes by reading
 * him. What the page can show, because it can be counted, is where each one takes
 * the sentence up — the paragraphs in which he quotes it — and how much he says
 * there; and it can set those paragraphs side by side, each in his own colour. The timeline is every work
 * on the tafsir shelf that has a passage on this ayah, by its author's death,
 * sized by how much it says (the measure the tafsir page uses).
 */

/** The five the matrix is drawn for, from five centuries and three kinds of tafsir. */
const MATRIX = ["tabari", "qurtubi", "alrazi", "ibn-katheer", "ibn-aashoor"];
const DEFAULT = ["tabari", "ibn-katheer", "qurtubi"];
/** The works the timeline may show, the mother works and those beside them. */
const TIMELINE = [
  "tabari", "ibn-abi-hatim", "baghawi", "ibn-atiyah", "zad-almaseer", "alrazi", "qurtubi", "albahr-almuheet",
  "ibn-katheer", "aldur-almanthoor", "fath-alqadeer", "alaloosi", "ibn-aashoor", "adwaa-albayan", "ibn-uthaymeen",
];

/** For each paragraph of a passage, which of the ayah's sentences it quotes. */
function bySentence(read: Read, ctx: StudyCtx): { text: string; quotes: Set<number> }[] {
  if (!read.p) return [];
  const n = ctx.words.length;
  return paras(read.p.text).map((text) => {
    const quotes = new Set<number>();
    for (const p of quotedIn(text, read.words)) {
      const l = local(p, read, n);
      if (!l) continue;
      for (const s of ctx.sentences) if (l.from <= s.to && l.to >= s.from) quotes.add(s.n);
    }
    return { text, quotes };
  });
}

/** A passage cut by sentence, worked out again only when the passage or the sentences change. */
function useSplit(read: Read, ctx: StudyCtx) {
  const { words, sentences } = ctx;
  return useMemo(() => bySentence(read, { words, sentences } as StudyCtx), [read, words, sentences]);
}

/** His paragraphs on one sentence: from where he quotes it to where he moves on to a later one. */
function onSentence(ps: { text: string; quotes: Set<number> }[], s: number): string[] {
  const start = ps.findIndex((p) => p.quotes.has(s));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start; i < ps.length; i++) {
    if (i > start && [...ps[i].quotes].some((q) => q > s) && !ps[i].quotes.has(s)) break;
    out.push(ps[i].text);
  }
  return out;
}

const words = (lines: string[]) => lines.join(" ").replace(/\[\[[\s\S]*?\]\]/g, " ").split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;

export function Mufassirun({ ctx }: { ctx: StudyCtx }) {
  const { t, n: num } = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const { sentence, sentences } = ctx;
  const lit = ctx.seen("mufassirun");
  const [chosen, setChosen] = useState<string[]>(DEFAULT);

  const tabari = useBook("tabari", ctx, near);
  const reads: Record<string, Read> = {
    tabari,
    qurtubi: useBook("qurtubi", ctx, near),
    alrazi: useBook("alrazi", ctx, near),
    "ibn-katheer": useBook("ibn-katheer", ctx, near),
    "ibn-aashoor": useBook("ibn-aashoor", ctx, near),
  };
  const zad = useBook("zad-almaseer", ctx, near);
  const mawardi = useBook("almawirdee", ctx, near);
  const zadViews = useViews(zad, ctx);
  const mawardiViews = useViews(mawardi, ctx);
  const count = ctx.words.length;
  const judgements = useMemo(
    () => (tabari.p ? readJudgements(tabari.p.text, tabari.words).filter((j) => local(j.at, tabari, count)) : []),
    [tabari, count],
  );
  const extraId = chosen.find((id) => !MATRIX.includes(id)) ?? "";
  const extra = useBook(extraId || "tabari", ctx, near && !!extraId);
  if (extraId) reads[extraId] = extra;

  const [measure, setMeasure] = useState<{ key: string; m: Record<string, number> } | null>(null);
  useEffect(() => {
    if (!near) return;
    let alive = true;
    file<{ works: Record<string, [number, number, number][]> }>(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/tafsir-map/${ctx.surah}.json`)
      .then((map) => {
        const m: Record<string, number> = {};
        for (const id of TIMELINE) {
          const found = map.works[id]?.find(([from, to]) => from <= ctx.ayah && ctx.ayah <= to);
          if (found) m[id] = found[2];
        }
        if (alive) setMeasure({ key: ctx.key, m });
      })
      .catch(() => alive && setMeasure({ key: ctx.key, m: {} }));
    return () => {
      alive = false;
    };
  }, [near, ctx.surah, ctx.ayah, ctx.key]);
  const sizes = measure?.key === ctx.key ? measure.m : {};

  const split: Record<string, { text: string; quotes: Set<number> }[]> = {
    tabari: useSplit(reads.tabari, ctx),
    qurtubi: useSplit(reads.qurtubi, ctx),
    alrazi: useSplit(reads.alrazi, ctx),
    "ibn-katheer": useSplit(reads["ibn-katheer"], ctx),
    "ibn-aashoor": useSplit(reads["ibn-aashoor"], ctx),
  };
  const extraSplit = useSplit(extra, ctx);
  if (extraId) split[extraId] = extraSplit;

  const toggle = (id: string) =>
    setChosen((c) => {
      if (c.includes(id)) return c.length > 1 ? c.filter((x) => x !== id) : c;
      const next = [...c, id];
      return next.length > 3 ? next.slice(1) : next;
    });

  const nodes = TIMELINE.filter((id) => sizes[id]).map((id) => ({ id, b: book(id)!, words: sizes[id] }));
  const most = Math.max(1, ...nodes.map((x) => x.words));
  const X = (d: number) => 4 + ((d - 100) / (1450 - 100)) * 92;

  return (
    <Chapter
      id="mufassirun"
      num="08"
      kicker={t("ulum.k.mufassirun")}
      title={t("ulum.t.mufassirun")}
      sub={t("ulum.s.mufassirun")}
      arabic="أقوال المفسرين"
      ctx={ctx}
      innerRef={ref}
    >
      <div className={styles.question}>
        <div className={styles.kicker}>{t("ulum.muf.sentence", { n: num(sentence.n), all: num(sentences.length) })}</div>
        <div className={styles.questionAr} lang="ar" dir="rtl">
          {ctx.words
            .filter((w) => w.j === sentence.n)
            .map((w) => w.ar)
            .join(" ")}
        </div>
        <p className={styles.prose}>{t("ulum.muf.ask")}</p>
      </div>

      <Block
        kicker={t("ulum.diff.kicker")}
        title={t("ulum.diff.title", { count: zadViews.length + mawardiViews.length })}
      >
        {zadViews.length + mawardiViews.length ? (
          <>
            <p className={styles.fromBook}>{t("ulum.diff.note")}</p>
            <Differences
              books={[
                { id: "zad-almaseer", read: zad, views: zadViews },
                { id: "almawirdee", read: mawardi, views: mawardiViews },
              ]}
              ctx={ctx}
            />
          </>
        ) : (
          <Silent>{zad.loading || mawardi.loading ? t("ulum.loading") : t("ulum.diff.none")}</Silent>
        )}
        {judgements.map((j, k) => (
          <Judgement key={k} id="tabari" text={j.text} read={tabari} ctx={ctx} />
        ))}
      </Block>

      <Block kicker={t("ulum.era.kicker")} title={t("ulum.era.title")} aside={<span className={styles.blockNote}>{t("ulum.era.tap")}</span>}>
        {nodes.length ? (
          <div className={styles.eraScroll}>
            <div className={`${styles.era} ${lit ? styles.eraDrawn : ""}`} style={{ minWidth: `${nodes.length * 104}px` }}>
              <div className={styles.eraCards} style={{ gridTemplateColumns: `repeat(${nodes.length}, minmax(0, 1fr))` }}>
                {nodes.map(({ id, b, words: w }, k) => {
                  const on = chosen.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={on ? styles.eraCardOn : styles.eraCard}
                      style={{ transitionDelay: `${500 + k * 90}ms` }}
                      onClick={() => toggle(id)}
                      aria-pressed={on}
                      title={b.name}
                    >
                      <span className={styles.eraName}>{b.short}</span>
                      <span className={styles.eraNameAr} lang="ar">
                        {b.shortArabic}
                      </span>
                      <span className={styles.eraDate}>{b.died ? t("ulum.died", { n: num(b.died) }) : t("ulum.era.now")}</span>
                      <span className={styles.eraBar}>
                        <span style={{ transform: `scaleX(${Math.max(0.04, w / most)})` }} />
                      </span>
                      <span className={styles.eraWords}>{t("ulum.era.words", { count: w, countText: num(w) })}</span>
                    </button>
                  );
                })}
              </div>
              <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className={styles.eraLines} aria-hidden>
                <path
                  d={nodes.map(({ b }, k) => `M${(((k + 0.5) / nodes.length) * 1000).toFixed(1)} 0 L${(X(b.died ?? 1440) * 10).toFixed(1)} 100`).join(" ")}
                  pathLength={1}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div className={styles.eraAxisRow}>
                <div className={styles.eraAxis} />
                {[200, 400, 600, 800, 1000, 1200, 1400].map((y) => (
                  <div key={y} className={styles.eraTick} style={{ left: `${X(y)}%` }}>
                    <span>{t("ulum.era.ah", { n: num(y) })}</span>
                  </div>
                ))}
                {nodes.map(({ id, b }) => (
                  <span
                    key={id}
                    className={chosen.includes(id) ? styles.eraDotOn : styles.eraDot}
                    style={{ left: `${X(b.died ?? 1440)}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Silent>{measure ? t("ulum.era.none") : t("ulum.loading")}</Silent>
        )}
      </Block>

      <Block kicker={t("ulum.matrix.kicker")} title={t("ulum.matrix.title")}>
        <div className={styles.matrixScroll}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th className={styles.matrixFirst}>{t("ulum.matrix.sentence")}</th>
                {MATRIX.map((id) => (
                  <th key={id} className={chosen.includes(id) ? styles.matrixHeadOn : styles.matrixHead} style={whoStyle(id)} onClick={() => toggle(id)}>
                    <span className={styles.whoName}>{book(id)?.short}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sentences.map((s) => (
                <tr key={s.n} className={s.n === sentence.n ? styles.matrixRowOn : undefined} onClick={() => ctx.pick(s.from)}>
                  <td className={styles.matrixFirst}>
                    <span className={styles.matrixNum}>{ar(s.n)}</span>
                    <span className={styles.matrixAr} lang="ar" dir="rtl">
                      {ctx.words
                        .filter((w) => w.j === s.n)
                        .slice(0, 6)
                        .map((w) => w.ar)
                        .join(" ")}
                      {s.to - s.from + 1 > 6 ? " …" : ""}
                    </span>
                  </td>
                  {MATRIX.map((id, k) => {
                    const read = reads[id];
                    const mine = onSentence(split[id] ?? [], s.n);
                    const w = words(mine);
                    return (
                      <td key={id} className={chosen.includes(id) ? styles.matrixCellOn : styles.matrixCell}>
                        {read.loading ? (
                          <span className={styles.dotLoading} />
                        ) : (
                          <span
                            className={`${mine.length ? styles.dotFull : styles.dotNone} ${lit ? styles.dotIn : ""}`}
                            style={{ transitionDelay: `${600 + (s.n * 5 + k) * 40}ms` }}
                            title={mine.length ? t("ulum.era.words", { count: w, countText: num(w) }) : t("ulum.matrix.passes")}
                          />
                        )}
                        {mine.length > 0 && ctx.scholar && <span className={styles.matrixWords}>{num(w)}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.legend}>
          <span className={styles.dotFullSmall} />
          {t("ulum.matrix.takes")}
          <span className={styles.dotNoneSmall} />
          {t("ulum.matrix.passes")}
        </div>
      </Block>

      <Block kicker={t("ulum.side.kicker")} title={t("ulum.side.title")}>
        <div className={styles.cards3} style={{ ["--cols" as string]: chosen.length }}>
          {chosen.map((id) => {
            const read = reads[id];
            const b = book(id);
            const mine = onSentence(split[id] ?? [], sentence.n);
            return (
              <article key={id} className={`${styles.card} ${styles.whoCard} ${lit ? styles.risen : ""}`} style={whoStyle(id)}>
                <div className={styles.cardHead}>
                  <span className={`${styles.cardName} ${styles.whoName}`}>{b?.short}</span>
                  <span className={styles.cardAr} lang="ar">
                    {b?.shortArabic}
                  </span>
                </div>
                <div className={styles.cardMeta}>
                  <i>{b?.name}</i>
                  {b?.died ? ` · ${t("ulum.died", { n: num(b.died) })}` : ""}
                </div>
                {read.loading ? (
                  <Silent>{t("ulum.loading")}</Silent>
                ) : mine.length ? (
                  ctx.scholar ? (
                    <BookText lines={mine} fold={3} />
                  ) : (
                    <p className={styles.cardText}>{t("ulum.side.student", { count: words(mine) })}</p>
                  )
                ) : read.p ? (
                  <Silent>{t("ulum.side.notHere")}</Silent>
                ) : (
                  <Silent>{t("ulum.silentOn")}</Silent>
                )}
                {read.p && <Cite id={id} ctx={ctx} range={read.p} />}
              </article>
            );
          })}
        </div>
      </Block>
    </Chapter>
  );
}
