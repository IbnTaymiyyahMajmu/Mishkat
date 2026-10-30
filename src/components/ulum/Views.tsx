"use client";

import { useMemo } from "react";
import { book } from "@/lib/ulum/books";
import { weakRoute, type Weak } from "@/lib/ulum/grades";
import { readViews, type Difference, type Holder, type View } from "@/lib/ulum/views";
import { useLocale } from "@/lib/i18n";
import { Cite, Deck, Leaves } from "./Chapter";
import { local, type Read, type StudyCtx } from "./study";
import { WeakNote } from "./Weak";
import { viewStyle, whoStyle } from "./who";
import styles from "./AyahStudy.module.css";

/**
 * Where the scholars differ: the views a book records, each in its own colour with
 * the names it gives, what the book says of them, and the author's own judgement
 * where he gives one. The page does not choose between them.
 *
 * A question is one card of a deck, its views side by side, so that twelve
 * questions on an ayah are turned through and do not run down the page. See
 * `src/lib/ulum/views.ts`.
 */

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

function ViewCell({ view, id, ctx }: { view: View; id: string; ctx: StudyCtx }) {
  const { t, n: num } = useLocale();
  const who = book(id)?.short ?? "";
  const weak = view.holders.map((h) => h.weak ?? weakRoute(h.via, h.who)).filter((w): w is Weak => !!w);
  const routes = weak.filter((w, k) => weak.findIndex((x) => x.words === w.words) === k).slice(0, 2);
  return (
    <div className={styles.diffView} style={{ ...viewStyle(view.n), ["--i" as string]: view.n }} data-standing={view.standing}>
      <div className={styles.diffNum}>
        {t("ulum.diff.view", { n: num(view.n) })}
        {view.standing && <span className={styles.standing}>{t(`ulum.diff.standing.${view.standing}`, { who })}</span>}
      </div>
      <Leaves lines={[view.text]} lineClass={styles.diffText} />
      <div className={styles.heldBy}>
        {view.holders.length ? (
          <>
            <span className={styles.heldLabel}>{t("ulum.diff.heldBy")}</span>
            {view.holders.slice(0, 8).map((h) => (
              <Chip key={`${h.who}${h.via}`} holder={h} />
            ))}
          </>
        ) : (
          <span className={styles.heldLabel}>{t("ulum.diff.noName")}</span>
        )}
      </div>
      {routes.map((w) => (
        <WeakNote key={w.words} weak={w} ctx={ctx} />
      ))}
    </div>
  );
}

function DifferenceCard({ d, id, read, ctx }: { d: Difference; id: string; read: Read; ctx: StudyCtx }) {
  const { t } = useLocale();
  const who = book(id)?.short ?? "";
  return (
    <article className={styles.difference} style={whoStyle(id)}>
      <div className={styles.diffBook}>
        <span className={styles.whoDot} aria-hidden />
        {who}
      </div>
      <div className={styles.diffHead} dir="rtl" lang="ar">
        {d.phrase && <span className={styles.diffPhrase}>﴿{d.phrase}﴾</span>}
        <span className={styles.diffTopic}>{d.topic}</span>
      </div>
      <div className={styles.diffViews}>
        {d.views.map((v) => (
          <ViewCell key={v.n} view={v} id={id} ctx={ctx} />
        ))}
      </div>
      {d.judgement && (
        <div className={styles.judgement}>
          <div className={styles.judgementHead}>{t("ulum.diff.judgement", { who })}</div>
          <Leaves lines={[d.judgement]} lineClass={styles.diffText} />
        </div>
      )}
      <Cite id={id} ctx={ctx} range={read.p} />
    </article>
  );
}

/** A book's lists of views that fall on this ayah. */
export function useViews(read: Read, ctx: Pick<StudyCtx, "words">, reader: typeof readViews = readViews): Difference[] {
  const n = ctx.words.length;
  return useMemo(() => {
    if (!read.p) return [];
    return reader(read.p.text, read.words)
      .filter((d) => local(d.at, read, n))
      .sort((a, b) => (a.at?.from ?? 0) - (b.at?.from ?? 0));
  }, [read, n, reader]);
}

/** The lists of several books, a card to a question, each under its book's colour. */
export function Differences({ books, ctx }: { books: { id: string; read: Read; views: Difference[] }[]; ctx: StudyCtx }) {
  const items = books.flatMap(({ id, read, views }) =>
    views.map((d, k) => <DifferenceCard key={`${id}${k}`} d={d} id={id} read={read} ctx={ctx} />),
  );
  return <Deck key={ctx.key} items={items} wide />;
}
