"use client";

import { useMemo, useRef } from "react";
import { devices, readDarwish, type Device, type Jadwal } from "@/lib/ulum/read";
import { useLocale } from "@/lib/i18n";
import { Block, BookText, Chapter, Cite, Silent } from "./Chapter";
import { figureOf } from "./terms";
import { local, useBook, useNear, type Read, type StudyCtx } from "./study";
import styles from "./AyahStudy.module.css";

/**
 * 04 · Balāghah — why it is said this way, and not another.
 *
 * Each figure is one Darwīsh or al-Ṣāfī names in his section on the rhetoric
 * of the ayah, in his words, with the words of the ayah his explanation quotes
 * lit where they stand. A figure whose explanation quotes nothing of the ayah
 * lights nothing — the page does not decide what he meant it of. Below them,
 * the commentators the library shelves for language and rhetoric, whole.
 */

const RHETORIC = ["ibn-aashoor", "abu-alsuod"];

export function Balagha({ ctx, jd }: { ctx: StudyCtx; jd: { j: Jadwal; read: Read } | null }) {
  const { t } = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const n = ctx.words.length;
  const lit = ctx.seen("balagha");

  const darwish = useBook("iraab-aldarweesh", ctx, near);
  const ashur = useBook(RHETORIC[0], ctx, near && ctx.scholar);
  const suud = useBook(RHETORIC[1], ctx, near && ctx.scholar);

  const figures = useMemo(() => {
    const out: { d: Device; id: string; read: Read }[] = [];
    if (darwish.p) for (const d of readDarwish(darwish.p.text, darwish.words).balagha) out.push({ d, id: "iraab-aldarweesh", read: darwish });
    if (jd) for (const d of devices(jd.j.balagha, jd.read.words)) out.push({ d, id: "aljadwal", read: jd.read });
    // A figure in a passage on several ayat is shown on the ayah whose words it
    // quotes; one that quotes nothing is shown only where the passage is this ayah's alone.
    return out.filter(({ d, read }) => {
      if (!d.name && !d.text.trim()) return false;
      if (d.at.length) return d.at.some((p) => local(p, read, n));
      return read.p?.from === read.p?.to;
    });
  }, [darwish, jd, n]);

  const named = figures.filter((f) => f.d.name);
  const unnamed = figures.filter((f) => !f.d.name);

  return (
    <Chapter id="balagha" num="04" kicker={t("ulum.k.balagha")} title={t("ulum.t.balagha")} sub={t("ulum.s.balagha")} arabic="البلاغة" ctx={ctx} innerRef={ref}>
      {named.length ? (
        named.map(({ d, id, read }, k) => {
          const spans = d.at.map((p) => local(p, read, n)).filter((x): x is { from: number; to: number } => !!x);
          const en = figureOf(d.name);
          return (
            <div key={`${id}-${k}`} className={styles.figure}>
              <div>
                <div className={styles.figureIdx}>{t("ulum.figure.n", { n: k + 1, all: named.length })}</div>
                <div className={styles.figureAr} lang="ar" dir="rtl">
                  {d.name}
                </div>
                {en && <div className={styles.figureEn}>{en}</div>}
              </div>
              <div className={styles.figureBody}>
                <div className={styles.figureAyah} dir="rtl" lang="ar">
                  {ctx.words.map((w) => {
                    const inside = spans.some((s) => s.from <= w.i && w.i <= s.to);
                    return (
                      <span
                        key={w.i}
                        className={inside && lit ? styles.figureLit : styles.figureWord}
                        style={{ transitionDelay: `${400 + k * 200}ms` }}
                      >
                        {w.ar}{" "}
                      </span>
                    );
                  })}
                </div>
                {ctx.scholar ? <BookText lines={d.text.split("\n")} /> : null}
                <Cite id={id} ctx={ctx} range={read.p} />
              </div>
            </div>
          );
        })
      ) : (
        !ctx.booksDown && <Silent>{darwish.loading ? t("ulum.loading") : t("ulum.figure.none")}</Silent>
      )}

      {ctx.scholar && unnamed.length > 0 && (
        <Block kicker={t("ulum.figure.more")} title={t("ulum.figure.moreTitle")}>
          {unnamed.map(({ d, id, read }, k) => (
            <div key={k} className={styles.subBlock}>
              <BookText lines={d.text.split("\n")} />
              <Cite id={id} ctx={ctx} range={read.p} />
            </div>
          ))}
        </Block>
      )}

      {ctx.scholar && (
        <Block kicker={t("ulum.rhetoric.kicker")} title={t("ulum.rhetoric.title")}>
          <div className={styles.cards2}>
            {[
              { id: RHETORIC[0], read: ashur },
              { id: RHETORIC[1], read: suud },
            ].map(({ id, read }) => (
              <article key={id} className={styles.card}>
                {read.p ? <BookText text={read.p.text} /> : <Silent>{read.loading ? t("ulum.loading") : t("ulum.silentOn")}</Silent>}
                {read.p && <Cite id={id} ctx={ctx} range={read.p} />}
              </article>
            ))}
          </div>
        </Block>
      )}
      {!ctx.scholar && named.length > 0 && <p className={styles.fromBook}>{t("ulum.figure.studentNote")}</p>}
    </Chapter>
  );
}
