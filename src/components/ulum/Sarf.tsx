"use client";

import { useMemo, useRef } from "react";
import { isCompound, readGrammar, sayPos } from "@/lib/quran/morphology";
import { spelledClass, stemOf, tags, toServed } from "@/lib/ulum/corpus";
import { readDarwish, waznOf, type Jadwal } from "@/lib/ulum/read";
import { bare } from "@/lib/ulum/skeleton";
import { useLocale } from "@/lib/i18n";
import { Block, Chapter, Cite, Line, Silent } from "./Chapter";
import { on, useBook, useNear, type Read, type StudyCtx } from "./study";
import styles from "./AyahStudy.module.css";

/**
 * 02 · Ṣarf — how the word is built, weighed and changed.
 *
 * The parts of the word and their grammar are the corpus's. The pattern it is
 * weighed by, and the original form it came from, are al-Ṣāfī's where he gives
 * them («وزنه فيعول», «أصله قيووم») — or Darwīsh's — and the scale is drawn only
 * from a pattern a book gave. A word no book weighs is not weighed here.
 */

const ROLE_KEY = { prefix: "study.role.prefix", stem: "study.role.stem", suffix: "study.role.suffix" } as const;

/** «وأصله «قيووم»», «أصله يؤأمنون» — the original form, as the book writes it. */
function aslOf(text: string): string | null {
  const m = /أصل(?:ه|ها)\s*[«(]?\s*([ء-يً-ْ]{2,14})/u.exec(text);
  return m ? m[1] : null;
}

/** The scale of ف ع ل laid over the root: which letters are the root's, which added, which dropped. */
function scale(pattern: string, root: string) {
  const rl = [...root];
  if (rl.length !== 3) return null;
  const pl = [...bare(pattern)];
  const slots: Record<string, number> = { ف: 0, ع: 1, ل: 2 };
  if (!pl.includes("ف") || !pl.includes("ع")) return null;
  const present = new Set(pl.filter((c) => c in slots));
  const seq: { p: string; r: string; kind: "radical" | "added" | "dropped"; idx?: number }[] = [];
  for (const c of pl) {
    if (c in slots) {
      const idx = slots[c];
      if (idx === 2 && !present.has("ع")) seq.push({ p: "ع", r: rl[1], kind: "dropped" });
      seq.push({ p: c, r: rl[idx], kind: "radical", idx });
    } else seq.push({ p: c, r: c, kind: "added" });
  }
  if (!present.has("ل")) seq.push({ p: "ل", r: rl[2], kind: "dropped" });
  return seq;
}

export function Sarf({ ctx, jd }: { ctx: StudyCtx; jd: { j: Jadwal; read: Read } | null }) {
  const { t, grammar } = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const { cur } = ctx;
  const n = ctx.words.length;
  const lit = ctx.seen("sarf");

  const darwish = useBook("iraab-aldarweesh", ctx, near);
  const dLughah = useMemo(() => (darwish.p ? readDarwish(darwish.p.text, darwish.words).lughah : []), [darwish]);

  const sarfNote = jd ? on(jd.j.sarf, jd.read, n, cur.i)[0] : undefined;
  const dNote = on(dLughah, darwish, n, cur.i)[0];
  const pattern = sarfNote ? waznOf(sarfNote.text) : null;
  const asl = (sarfNote && aslOf(sarfNote.text)) || (dNote && aslOf(dNote.text)) || null;
  const aslFrom = sarfNote && aslOf(sarfNote.text) ? "aljadwal" : "iraab-aldarweesh";
  const cells = pattern && cur.root ? scale(pattern, cur.root) : null;

  const grammars = cur.segs.map((s) => readGrammar(toServed(s), spelledClass(s), grammar));
  const stem = stemOf(cur.segs);
  const stemGrammar = stem ? readGrammar(toServed(stem), spelledClass(stem), grammar) : null;
  const compound = isCompound(grammars);
  const RADICAL = [t("ulum.radical1"), t("ulum.radical2"), t("ulum.radical3")];

  return (
    <Chapter id="sarf" num="02" kicker={t("ulum.k.sarf")} title={t("ulum.t.sarf")} sub={t("ulum.s.sarf")} arabic="الصرف" ctx={ctx} innerRef={ref}>
      <Block kicker={t("ulum.exploded.kicker")} title={t("ulum.exploded.title")}>
        <div className={`${styles.exploded} ${lit && compound ? styles.explodedOpen : ""}`} dir="rtl">
          {cur.segs.map((s, k) => {
            const g = grammars[k];
            const role = tags(s[2]).includes("PREF") ? "prefix" : tags(s[2]).includes("SUFF") ? "suffix" : "stem";
            return (
              <div key={k} className={styles.seg} data-role={role}>
                <div className={styles.segForm} lang="ar">
                  {s[0]}
                </div>
                <div className={styles.segDrop} />
                <div className={styles.segDot} />
                <div className={styles.segLabel} dir="ltr">
                  {sayPos(toServed(s), spelledClass(s), grammar)}
                </div>
                <div className={styles.segRole} dir="ltr">
                  {t(ROLE_KEY[role])}
                  {g.lemma && role === "stem" ? (
                    <span lang="ar" className={styles.segLemma}>
                      {" "}
                      · {g.lemma}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {stemGrammar && stemGrammar.traits.length > 0 && (
          <div className={styles.traits}>
            {stemGrammar.traits.map((x) => (
              <span key={x} className={styles.trait}>
                {x}
              </span>
            ))}
          </div>
        )}
      </Block>

      <Block kicker={t("ulum.scale.kicker")} title={t("ulum.scale.title")}>
        {cells ? (
          <div className={styles.mizan}>
            <div>
              <div className={styles.miniKicker}>{t("ulum.scale.pattern")}</div>
              <div className={styles.mizanPattern} lang="ar" dir="rtl">
                {pattern}
              </div>
              <p className={styles.prose}>{t("ulum.scale.how")}</p>
            </div>
            <div className={styles.mizanCells} dir="rtl">
              {cells.map((c, k) => (
                <div
                  key={k}
                  className={`${styles.mizanCell} ${lit ? styles.risen : ""}`}
                  data-kind={c.kind}
                  style={{ transitionDelay: `${300 + k * 120}ms` }}
                >
                  <div className={styles.mizanP} lang="ar">
                    {c.p}
                  </div>
                  <div className={styles.mizanLine} />
                  <div className={styles.mizanBox}>
                    <span lang="ar">{c.r}</span>
                  </div>
                  <div className={styles.mizanLab} dir="ltr">
                    {c.kind === "radical" ? RADICAL[c.idx!] : c.kind === "added" ? t("ulum.scale.added") : t("ulum.scale.dropped")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !ctx.booksDown && <Silent>{cur.root ? t("ulum.scale.none") : t("ulum.scale.fixed")}</Silent>
        )}
        {cells && <Cite id="aljadwal" ctx={ctx} range={jd?.read.p} />}
      </Block>

      {asl && (
        <Block kicker={t("ulum.tasrif.kicker")} title={t("ulum.tasrif.title")}>
          <div className={styles.tasrif} dir="rtl">
            <div className={styles.tasrifSide}>
              <div className={styles.tasrifFrom} lang="ar">
                {asl}
              </div>
              <div className={styles.miniKicker} dir="ltr">
                {t("ulum.tasrif.asl")}
              </div>
            </div>
            <svg viewBox="0 0 200 30" className={`${styles.tasrifArrow} ${lit ? styles.drawn : ""}`} aria-hidden>
              <path d="M196 15H6M18 4 6 15l12 11" pathLength={1} />
            </svg>
            <div className={styles.tasrifSide}>
              <div className={styles.tasrifTo} lang="ar">
                {stem?.[0] ?? cur.ar}
              </div>
              <div className={styles.miniKicker} dir="ltr">
                {t("ulum.tasrif.read")}
              </div>
            </div>
          </div>
          <Cite id={aslFrom} ctx={ctx} range={aslFrom === "aljadwal" ? jd?.read.p : darwish.p} />
        </Block>
      )}

      {(sarfNote || dNote) && ctx.scholar && (
        <Block kicker={t("ulum.sarfNote.kicker")} title={t("ulum.sarfNote.title", { word: cur.ar })}>
          <div className={styles.cards2}>
            {sarfNote && (
              <article className={styles.card}>
                <Line text={`(${sarfNote.quote}) ${sarfNote.text}`} className={styles.cardArText} />
                {sarfNote.notes.map((x, i) => (
                  <Line key={i} text={`[[${x}]]`} className={styles.cardArNote} />
                ))}
                <Cite id="aljadwal" ctx={ctx} range={jd?.read.p} />
              </article>
            )}
            {dNote && (
              <article className={styles.card}>
                <Line text={`(${dNote.quote}) ${dNote.text}`} className={styles.cardArText} />
                <Cite id="iraab-aldarweesh" ctx={ctx} range={darwish.p} />
              </article>
            )}
          </div>
        </Block>
      )}
    </Chapter>
  );
}
