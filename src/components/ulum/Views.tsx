"use client";

import { useEffect, useMemo } from "react";
import { book } from "@/lib/ulum/books";
import { weakRoute, type Weak } from "@/lib/ulum/grades";
import { readViews, type Difference, type Holder, type View } from "@/lib/ulum/views";
import { useLocale } from "@/lib/i18n";
import { Cite, Fold, Line } from "./Chapter";
import { local, type Read, type StudyCtx } from "./study";
import { viewStyle, whoStyle } from "./who";
import styles from "./AyahStudy.module.css";

/**
 * Where the scholars differ, and that a report is weak: the two things the page
 * has to say plainly, wherever they come up.
 *
 * A difference is set out as the book that records it sets it out: what they
 * differ on, then each view in its own colour with the names it gives. The page
 * does not choose between them. See `src/lib/ulum/views.ts`.
 */

/** The page in al-Itqān where al-Suyūṭī names the routes, on Shamela. */
const ITQAN = "https://shamela.ws/book/11728/1397";

/** That a report is weak, how, why, and who says so. */
export function WeakNote({ weak, ctx }: { weak: Weak; ctx: StudyCtx }) {
  const { t } = useLocale();
  const place = t("ulum.ahkam.volPage", { vol: 4, page: 239 });
  const fromItqan = weak.by === "itqan";
  useEffect(() => {
    if (fromItqan) ctx.cite("al-itqan", place);
  }, [ctx, fromItqan, place]);
  return (
    <div className={styles.weak}>
      <div className={styles.weakHead}>
        <span className={styles.weakTag}>{t(`ulum.weak.${weak.kind}`)}</span>
        <span className={styles.weakAspect}>{t(weak.aspect === "chain" ? "ulum.weak.inChain" : "ulum.weak.inText")}</span>
      </div>
      {weak.route && <p className={styles.weakWhy}>{t(`ulum.weak.why.${weak.route}`)}</p>}
      {weak.kind === "unnamed" && <p className={styles.weakWhy}>{t("ulum.weak.why.unnamed")}</p>}
      <p className={styles.weakWords} dir="rtl" lang="ar">
        «{weak.words}»
      </p>
      <p className={styles.weakBy}>
        {fromItqan ? (
          <a href={ITQAN} target="_blank" rel="noopener noreferrer">
            {t("ulum.weak.byItqan")}
          </a>
        ) : (
          t(weak.by === "editor" ? "ulum.weak.byEditor" : "ulum.weak.byChain")
        )}
      </p>
    </div>
  );
}

function Chip({ holder }: { holder: Holder }) {
  const { t } = useLocale();
  return (
    <span className={styles.heldChip}>
      <span lang="ar">{holder.who}</span>
      {holder.via && (
        <span className={styles.heldVia} lang="ar">
          {t("ulum.diff.via", { via: holder.via })}
        </span>
      )}
    </span>
  );
}

function ViewRow({ view, ctx }: { view: View; ctx: StudyCtx }) {
  const { t, n: num } = useLocale();
  const weak = view.holders.map((h) => weakRoute(h.via, h.who)).filter((w): w is Weak => !!w);
  const routes = weak.filter((w, k) => weak.findIndex((x) => x.route === w.route) === k);
  return (
    <div className={styles.diffView} style={viewStyle(view.n)}>
      <div className={styles.diffNum}>{t("ulum.diff.view", { n: num(view.n) })}</div>
      <Line text={view.text} className={styles.diffText} />
      <div className={styles.heldBy}>
        {view.holders.length ? (
          <>
            <span className={styles.heldLabel}>{t("ulum.diff.heldBy")}</span>
            {view.holders.map((h) => (
              <Chip key={`${h.who}${h.via}`} holder={h} />
            ))}
          </>
        ) : (
          <span className={styles.heldLabel}>{t("ulum.diff.noName")}</span>
        )}
      </div>
      {routes.map((w) => (
        <WeakNote key={w.route} weak={w} ctx={ctx} />
      ))}
    </div>
  );
}

function DifferenceCard({ d, id, read, ctx }: { d: Difference; id: string; read: Read; ctx: StudyCtx }) {
  return (
    <article className={styles.difference} style={whoStyle(id)}>
      <div className={styles.diffBook}>
        <span className={styles.whoDot} aria-hidden />
        {book(id)?.short}
      </div>
      <div className={styles.diffHead} dir="rtl" lang="ar">
        {d.phrase && <span className={styles.diffPhrase}>﴿{d.phrase}﴾</span>}
        <span className={styles.diffTopic}>{d.topic}</span>
      </div>
      {d.views.map((v) => (
        <ViewRow key={v.n} view={v} ctx={ctx} />
      ))}
      <Cite id={id} ctx={ctx} range={read.p} />
    </article>
  );
}

/** A book's lists of views that fall on this ayah. */
export function useViews(read: Read, ctx: Pick<StudyCtx, "words">): Difference[] {
  const n = ctx.words.length;
  return useMemo(() => {
    if (!read.p) return [];
    return readViews(read.p.text, read.words)
      .filter((d) => local(d.at, read, n))
      .sort((a, b) => (a.at?.from ?? 0) - (b.at?.from ?? 0));
  }, [read, n]);
}

/** The lists of several books, each under the book's colour. */
export function Differences({ books, ctx }: { books: { id: string; read: Read; views: Difference[] }[]; ctx: StudyCtx }) {
  const { t } = useLocale();
  const items = books.flatMap(({ id, read, views }) =>
    views.map((d, k) => <DifferenceCard key={`${id}${k}`} d={d} id={id} read={read} ctx={ctx} />),
  );
  return <Fold key={ctx.key} items={items} first={4} label={(count) => t("ulum.diff.more", { count })} />;
}

/** A scholar's own judgement between the views, in his words and his colour. */
export function Judgement({ id, text, read, ctx }: { id: string; text: string; read: Read; ctx: StudyCtx }) {
  const { t } = useLocale();
  return (
    <article className={styles.judgement} style={whoStyle(id)}>
      <div className={styles.judgementHead}>{t("ulum.diff.judgement", { who: book(id)?.short ?? "" })}</div>
      <Line text={text} className={styles.cardArText} />
      <Cite id={id} ctx={ctx} range={read.p} />
    </article>
  );
}
