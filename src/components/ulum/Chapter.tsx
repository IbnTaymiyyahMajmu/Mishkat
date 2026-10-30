"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { book, bookUrl, credit } from "@/lib/ulum/books";
import { useLocale } from "@/lib/i18n";
import { paras, type StudyCtx } from "./study";
import { whoStyle } from "./who";
import styles from "./AyahStudy.module.css";

/**
 * The parts every chapter of the ayah study is built from: its opening, its
 * sub-headings, the line that names a book and where it was opened, and a
 * book's own words set as the book set them.
 */

/** The chapters that rest on the books the app reads from the site. */
const NEEDS_THE_BOOKS = new Set(["sarf", "nahw", "balagha", "qiraat"]);

export function Chapter({
  id,
  num,
  kicker,
  title,
  sub,
  arabic,
  ctx,
  innerRef,
  children,
}: {
  id: string;
  num: string;
  kicker: string;
  title: string;
  sub: string;
  arabic: string;
  ctx: StudyCtx;
  innerRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <section id={`s-${id}`} data-ch={id} className={styles.chapter} ref={innerRef}>
      <div className={styles.wrap}>
        <header className={`${styles.opener} ${ctx.seen(id) ? styles.risen : ""}`}>
          <div className={styles.openNum} aria-hidden>
            {num}
          </div>
          <div className={styles.openText}>
            <div className={styles.kicker}>{kicker}</div>
            <h2 className={styles.openTitle}>{title}</h2>
            <div className={styles.openSub}>{sub}</div>
          </div>
          <div className={styles.openArabic} dir="rtl" lang="ar">
            {arabic}
          </div>
        </header>
        {ctx.booksDown && NEEDS_THE_BOOKS.has(id) && <Silent>{t("ulum.booksDown")}</Silent>}
        {children}
      </div>
    </section>
  );
}

export function Block({
  kicker,
  title,
  aside,
  children,
}: {
  kicker: string;
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <span className={styles.kicker}>{kicker}</span>
        {title && <span className={styles.blockTitle}>{title}</span>}
        {aside && <span className={styles.blockAside}>{aside}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Which book, and where: «al-Samīn al-Ḥalabī, al-Durr al-maṣūn · 2:255», a link
 * to the same passage on tafsir.app, where it can be checked against the copy
 * that was digitised from the printed edition. A book checked elsewhere names
 * its own `where` and passes the link.
 */
export function Cite({
  id,
  ctx,
  where,
  range,
  check,
}: {
  id: string;
  ctx: StudyCtx;
  /** A place inside the book, where it numbers its own — a report's number. */
  where?: string;
  /** The ayat the passage covers, where it is more than this one. */
  range?: { from: number; to: number } | null;
  /** Where to check it, for a book not on tafsir.app. */
  check?: { href: string; label: string };
}) {
  const { t } = useLocale();
  const b = book(id);
  const span =
    range && range.from !== range.to ? `${ctx.surah}:${range.from}–${range.to}` : `${ctx.surah}:${ctx.ayah}`;
  const place = where && check ? where : where ? `${span} · ${where}` : span;
  useEffect(() => {
    ctx.cite(id, place);
  }, [ctx, id, place]);
  if (!b) return null;
  return (
    <div className={styles.cite} style={whoStyle(id)}>
      <span className={styles.citeWork}>
        <span className={styles.whoDot} aria-hidden />
        <i>{b.name}</i> · {credit(b)}
      </span>
      <span className={styles.citeWhere}>{place}</span>
      <a className={styles.citeLink} href={check?.href ?? bookUrl(id, ctx.key)} target="_blank" rel="noopener noreferrer">
        {check?.label ?? t("ulum.check")}
      </a>
    </div>
  );
}

/** The editor's footnote inside a line of the copy: `[[…]]`. */
const NOTE = /\[\[([\s\S]*?)\]\]/g;

/** One paragraph of a book, with its editor's notes set apart from the author's words. */
export function Line({ text, className }: { text: string; className?: string }) {
  const parts = text.split(NOTE);
  return (
    <p className={className ?? styles.bookPara} dir="rtl" lang="ar">
      {parts.map((part, i) =>
        i % 2 ? (
          <span key={i} className={styles.editorNote}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

/**
 * A book's passage, in its own words and its own paragraphs, folded after a
 * few of them where it runs long. Nothing in it is altered; the page marks of
 * the printed edition are taken out, as they are on the tafsir page.
 */
export function BookText({ text, lines, fold = 4 }: { text?: string; lines?: string[]; fold?: number }) {
  const { t } = useLocale();
  const all = lines ?? paras(text ?? "");
  const [open, setOpen] = useState(false);
  const shown = open ? all : all.slice(0, fold);
  return (
    <div className={styles.bookText}>
      {shown.map((p, i) => (
        <Line key={i} text={p} />
      ))}
      {all.length > fold && (
        <button type="button" className={styles.more} onClick={() => setOpen(!open)}>
          {open ? t("ulum.less") : t("ulum.more", { count: all.length - fold })}
        </button>
      )}
    </div>
  );
}

/** A long list, its first few and the rest on asking. */
export function Fold({ items, first = 5, label }: { items: ReactNode[]; first?: number; label: (count: number) => string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <>
      {open ? items : items.slice(0, first)}
      {items.length > first && (
        <button type="button" className={styles.more} onClick={() => setOpen(!open)}>
          {open ? t("ulum.less") : label(items.length - first)}
        </button>
      )}
    </>
  );
}

/** A book that has nothing on this ayah, or could not be reached — said, not hidden. */
export function Silent({ children }: { children: ReactNode }) {
  return <p className={styles.silent}>{children}</p>;
}

/** The author and his death date, as the colophon gives them. */
export function By({ id }: { id: string }) {
  const b = book(id);
  return b ? <span className={styles.by}>{credit(b)}</span> : null;
}
