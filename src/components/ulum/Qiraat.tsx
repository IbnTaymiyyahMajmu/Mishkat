"use client";

import { useMemo, useRef } from "react";
import { namedWords, readMawsuah } from "@/lib/ulum/read";
import { bare } from "@/lib/ulum/skeleton";
import { useLocale } from "@/lib/i18n";
import { leftOut } from "@/lib/ulum/books";
import { Block, BookText, Chapter, Cite, Line } from "./Chapter";
import { local, useBook, useNear, type StudyCtx } from "./study";
import styles from "./AyahStudy.module.css";

/**
 * 05 · Qirāʾāt — where the transmitted readings differ.
 *
 * Two kinds of book, kept apart as the science keeps them apart. Ibn
 * al-Jazarī's al-Nashr and Taḥbīr al-taysīr are the reference works of the
 * ten readings: a word either of them takes up is marked solid on the map.
 * Al-Abyārī lists every reading of a word he found, the ten and the rest, and
 * says of some that they are irregular (شاذ); those are marked dotted, and a
 * student is not shown them. Whether a reading not so marked is one of the
 * ten is for al-Nashr to say, not this page.
 */

const TEN = ["alnashir", "tahbeer-altayseer"];

export function Qiraat({ ctx }: { ctx: StudyCtx }) {
  const { t } = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const { cur } = ctx;
  const n = ctx.words.length;
  const lit = ctx.seen("qiraat");

  const nashr = useBook(TEN[0], ctx, near);
  const tahbir = useBook(TEN[1], ctx, near);
  const kirmani = useBook("mafateeh-alaghanee", ctx, near);
  const abyari = useBook("qiraat-almawsoah", ctx, near);

  const variants = useMemo(() => (abyari.p ? readMawsuah(abyari.p.text, abyari.words) : []), [abyari]);
  const tenWords = useMemo(() => {
    const set = new Set<number>();
    for (const read of [nashr, tahbir]) {
      if (!read.p) continue;
      for (const p of namedWords(read.p.text, read.words)) {
        const l = local(p, read, n);
        if (l) for (let i = l.from; i <= l.to; i++) set.add(i);
      }
    }
    return set;
  }, [nashr, tahbir, n]);

  const here = variants
    .map((v) => ({ v, l: local(v.at, abyari, n) }))
    .filter((x): x is { v: (typeof variants)[number]; l: { from: number; to: number } } => !!x.l)
    .filter(({ v }) => ctx.scholar || !v.shadh);
  const marked = new Map<number, "ten" | "shadh" | "listed">();
  for (const { v, l } of here) for (let i = l.from; i <= l.to; i++) marked.set(i, v.shadh ? "shadh" : "listed");
  for (const i of tenWords) marked.set(i, "ten");

  const onWord = here.filter(({ l }) => l.from <= cur.i && cur.i <= l.to);
  const books = [
    { id: TEN[0], read: nashr },
    { id: TEN[1], read: tahbir },
    { id: "mafateeh-alaghanee", read: kirmani },
  ];
  const loading = abyari.loading || nashr.loading;

  return (
    <Chapter id="qiraat" num="05" kicker={t("ulum.k.qiraat")} title={t("ulum.t.qiraat")} sub={t("ulum.s.qiraat")} arabic="القراءات" ctx={ctx} innerRef={ref}>
      <Block
        kicker={t("ulum.qmap.kicker")}
        title={t("ulum.qmap.title")}
        aside={
          <span className={styles.legend}>
            <span className={styles.legendUnder} />
            {t("ulum.qmap.ten")}
            <span className={styles.legendUnderThin} />
            {t("ulum.qmap.listed")}
            {ctx.scholar && (
              <>
                <span className={styles.legendDotted} />
                {t("ulum.qmap.shadh")}
              </>
            )}
          </span>
        }
      >
        <div className={styles.qmap} dir="rtl" lang="ar">
          {ctx.words.map((w) => {
            const m = marked.get(w.i);
            return (
              <button
                key={w.i}
                type="button"
                data-mark={lit ? (m ?? "") : ""}
                className={w.i === cur.i ? styles.qWordOn : styles.qWord}
                onClick={() => ctx.pick(w.i)}
              >
                {w.ar}
              </button>
            );
          })}
        </div>
      </Block>

      <Block kicker={t("ulum.qword.kicker")} title={t("ulum.qword.title", { word: cur.ar })}>
        {onWord.length ? (
          onWord.map(({ v }, k) => (
            <div key={k} className={styles.readings}>
              {v.readings.map((r, i) => {
                const majority = /الجمهور|العامة|الباقون/.test(bare(r));
                return (
                  <div key={i} className={`${styles.reading} ${lit ? styles.risen : ""}`} style={{ transitionDelay: `${200 + i * 140}ms` }}>
                    <Line text={r} className={styles.readingAr} />
                    <span className={v.shadh ? styles.statusShadh : majority ? styles.statusMain : styles.statusPlain}>
                      {v.shadh ? t("ulum.qword.shadh") : majority ? t("ulum.qword.majority") : tenWords.has(cur.i) ? t("ulum.qword.seeTen") : t("ulum.qword.listed")}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          !ctx.booksDown && (
            <div className={styles.two}>
              <div className={styles.bigLine}>{loading ? t("ulum.loading") : t("ulum.qword.none", { word: cur.ar })}</div>
              {!loading && <p className={styles.prose}>{marked.size ? t("ulum.qword.elsewhere") : t("ulum.qword.noneInAyah")}</p>}
            </div>
          )
        )}
        {abyari.p && onWord.length > 0 && <Cite id="qiraat-almawsoah" ctx={ctx} range={abyari.p} />}
      </Block>

      {books.some((b) => b.read.p) && (
        <Block kicker={t("ulum.qbooks.kicker")} title={t("ulum.qbooks.title")}>
          <div className={styles.cards2}>
            {books.map(({ id, read }) =>
              read.p ? (
                <article key={id} className={styles.card}>
                  {ctx.scholar ? <BookText text={read.p.text} /> : <p className={styles.cardText}>{t("ulum.qbooks.student")}</p>}
                  {leftOut(id, ctx.surah, ctx.ayah) && <p className={styles.fromBook}>{t("ulum.qiraat.leftOut")}</p>}
                  <Cite id={id} ctx={ctx} range={read.p} />
                </article>
              ) : null,
            )}
          </div>
        </Block>
      )}
    </Chapter>
  );
}
