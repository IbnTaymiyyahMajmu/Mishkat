"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchVerseWithWords } from "@/lib/quran/api";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { useSettings } from "@/lib/store/settings";
import { plainText } from "@/lib/text";
import { fetchEchoes, type EchoRun } from "@/lib/ulum/corpus";
import { useLocale } from "@/lib/i18n";
import { Block, BookText, Chapter, Cite, Silent } from "./Chapter";
import { ar, useBook, useNear, type StudyCtx } from "./study";
import styles from "./AyahStudy.module.css";

/**
 * 10 · Munāsabāt — the Qurʾān answering itself.
 *
 * The web is drawn from the muṣḥaf alone: every run of three or more of this
 * ayah's words that stands word for word in another ayah (`build-ulum.mjs`),
 * hung on the sentence it comes from. That is the verbal tie, and it is a fact
 * of the text, not a reading of it. The tie of meaning between an ayah and
 * those around it is al-Biqāʿī's subject, and his Naẓm al-durar is below, in
 * his words. The ayat the commentators bring in to explain this one are in
 * chapter seven.
 */

const OFFSET = SURAH_NAMES.reduce<number[]>((acc, s, i) => (acc.push(acc[i] + s.ayat), acc), [0]);
function keyAt(serial: number): string {
  let s = 1;
  while (OFFSET[s] < serial) s++;
  return `${s}:${serial - OFFSET[s - 1]}`;
}

interface Echo {
  from: number;
  to: number;
  count: number;
  others: { key: string; at: number }[];
}

function readRuns(runs: EchoRun[]): Echo[] {
  return runs.map(([from, to, count, ...rest]) => {
    const others: { key: string; at: number }[] = [];
    for (let i = 0; i + 1 < rest.length; i += 2) others.push({ key: keyAt(rest[i]), at: rest[i + 1] });
    return { from, to, count, others };
  });
}

export function Munasabat({ ctx }: { ctx: StudyCtx }) {
  const { t, n: num } = useLocale();
  const { settings } = useSettings();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const { sentence, sentences } = ctx;
  const lit = ctx.seen("munasabat");
  const biqai = useBook("nathm-aldurar", ctx, near && ctx.scholar);

  const [runs, setRuns] = useState<{ key: string; echoes: Echo[] } | null>(null);
  useEffect(() => {
    if (!near) return;
    let alive = true;
    fetchEchoes(ctx.surah)
      .then((f) => alive && setRuns({ key: ctx.key, echoes: readRuns(f.ayat[ctx.ayah - 1] ?? []) }))
      .catch(() => alive && setRuns({ key: ctx.key, echoes: [] }));
    return () => {
      alive = false;
    };
  }, [near, ctx.surah, ctx.ayah, ctx.key]);
  const echoes = useMemo(() => (runs?.key === ctx.key ? runs.echoes : []), [runs, ctx.key]);

  /** Each sentence's echoes: the other ayat, longest run first, each ayah once. */
  const bySentence = useMemo(() => {
    const out = new Map<number, { key: string; at: number; from: number; to: number }[]>();
    for (const s of sentences) {
      const list: { key: string; at: number; from: number; to: number }[] = [];
      const seen = new Set<string>();
      for (const e of [...echoes].sort((a, b) => b.to - b.from - (a.to - a.from))) {
        if (e.from > s.to || e.to < s.from) continue;
        for (const o of e.others) {
          if (seen.has(o.key)) continue;
          seen.add(o.key);
          list.push({ ...o, from: e.from, to: e.to });
        }
      }
      out.set(s.n, list);
    }
    return out;
  }, [echoes, sentences]);

  const mine = bySentence.get(sentence.n) ?? [];
  const shown = mine.slice(0, 6);
  const [texts, setTexts] = useState<Record<string, { words: string[]; en: string }>>({});
  const wanted = shown.map((s) => s.key).join(",");
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    for (const key of wanted.split(",")) {
      fetchVerseWithWords(key, settings.translationId)
        .then((v) => {
          if (!alive || !v) return;
          const words = v.words.filter((w) => w.char_type_name === "word").map((w) => w.text_uthmani ?? "");
          setTexts((x) => ({ ...x, [key]: { words, en: plainText(v.translations?.[0]?.text ?? "") } }));
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [wanted, settings.translationId]);

  // ── the web ───────────────────────────────────────────────────────────────
  const nJ = sentences.length;
  const cx = 600;
  const cy = 320;
  const pt = (deg: number, rx: number, ry: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  };
  let dOff = "";
  let dOn = "";
  const inner: { n: number; x: number; y: number }[] = [];
  const outer: { key: string; x: number; y: number; n: number }[] = [];
  sentences.forEach((s, k) => {
    const ang = -90 + (360 / nJ) * k;
    const me = s.n === sentence.n;
    const [x1, y1] = nJ === 1 ? [cx, cy - 150] : pt(ang, 250, 150);
    const seg = `M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} `;
    if (me) dOn += seg;
    else dOff += seg;
    inner.push({ n: s.n, x: x1, y: y1 });
    const links = (bySentence.get(s.n) ?? []).slice(0, nJ > 6 ? 2 : nJ > 3 ? 3 : 5);
    const spread = nJ > 4 ? 11 : 22;
    links.forEach((l, i) => {
      const a2 = ang + (i - (links.length - 1) / 2) * spread;
      const [x2, y2] = pt(a2, 500, 268);
      const s2 = `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} `;
      if (me) dOn += s2;
      else dOff += s2;
      outer.push({ key: l.key, x: x2, y: y2, n: s.n });
    });
  });

  return (
    <Chapter id="munasabat" num="10" kicker={t("ulum.k.munasabat")} title={t("ulum.t.munasabat")} sub={t("ulum.s.munasabat")} arabic="المناسبات" ctx={ctx} innerRef={ref}>
      <Block kicker={t("ulum.web.kicker")} title={t("ulum.web.title")}>
        {runs && echoes.length === 0 ? (
          <Silent>{t("ulum.web.none")}</Silent>
        ) : (
          <div className={`${styles.web} ${lit ? styles.webDrawn : ""}`}>
            <svg viewBox="0 0 1200 640" preserveAspectRatio="none" className={styles.webSvg} aria-hidden>
              <path d={dOff || "M0 0"} className={styles.webOff} pathLength={1} vectorEffect="non-scaling-stroke" />
              <path d={dOn || "M0 0"} className={styles.webOn} pathLength={1} vectorEffect="non-scaling-stroke" />
            </svg>
            <div className={styles.webCentre}>
              <span className={styles.webKey}>{ctx.key}</span>
              <span lang="ar">{SURAH_NAMES[ctx.surah - 1]?.arabic}</span>
            </div>
            {inner.map((p, k) => (
              <button
                key={p.n}
                type="button"
                className={p.n === sentence.n ? styles.webInnerOn : styles.webInner}
                style={{ left: `${p.x / 12}%`, top: `${p.y / 6.4}%`, transitionDelay: `${300 + k * 60}ms` }}
                onClick={() => {
                  const s = sentences.find((x) => x.n === p.n);
                  if (s) ctx.pick(s.from);
                }}
                title={t("ulum.pickSentence", { n: p.n })}
              >
                {ar(p.n)}
              </button>
            ))}
            {outer.map((o, k) => (
              <Link
                key={`${o.key}-${k}`}
                href={`/ayah/?v=${o.key}`}
                className={o.n === sentence.n ? styles.webOuterOn : styles.webOuter}
                style={{ left: `${o.x / 12}%`, top: `${o.y / 6.4}%`, transitionDelay: `${700 + k * 40}ms` }}
              >
                {o.key}
              </Link>
            ))}
          </div>
        )}
        <p className={styles.fromBook}>{t("ulum.web.note")}</p>
      </Block>

      <Block kicker={t("ulum.echo.kicker", { n: num(sentence.n) })} title={t("ulum.echo.title")}>
        {shown.length ? (
          <div className={styles.cards2}>
            {shown.map((e, k) => {
              const other = texts[e.key];
              const len = e.to - e.from + 1;
              return (
                <article key={e.key} className={`${styles.echo} ${lit ? styles.risen : ""}`} style={{ transitionDelay: `${300 + k * 150}ms` }}>
                  <div className={styles.echoHead}>
                    <Link href={`/ayah/?v=${e.key}`} className={styles.echoKey}>
                      {e.key}
                    </Link>
                    <span className={styles.tagOutline}>{t("ulum.echo.words", { count: len })}</span>
                  </div>
                  <div className={styles.echoAr} dir="rtl" lang="ar">
                    {other
                      ? other.words.map((w, i) => (
                          <span key={i} className={i + 1 >= e.at && i + 1 < e.at + len ? styles.echoHit : undefined}>
                            {w}{" "}
                          </span>
                        ))
                      : "…"}
                  </div>
                  {other?.en && <div className={styles.echoEn}>{other.en}</div>}
                </article>
              );
            })}
          </div>
        ) : (
          <Silent>{runs ? t("ulum.echo.none") : t("ulum.loading")}</Silent>
        )}
        {mine.length > shown.length && <p className={styles.fromBook}>{t("ulum.echo.more", { count: mine.length - shown.length })}</p>}
      </Block>

      {ctx.scholar && (
        <Block kicker={t("ulum.biqai.kicker")} title={t("ulum.biqai.title")}>
          {biqai.p ? (
            <>
              <BookText text={biqai.p.text} fold={4} />
              <Cite id="nathm-aldurar" ctx={ctx} range={biqai.p} />
            </>
          ) : (
            <Silent>{biqai.loading ? t("ulum.loading") : t("ulum.silentOn")}</Silent>
          )}
        </Block>
      )}
    </Chapter>
  );
}
