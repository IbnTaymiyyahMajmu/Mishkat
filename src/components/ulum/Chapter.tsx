"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { book, bookUrl, credit } from "@/lib/ulum/books";
import { labelsOf } from "@/lib/ulum/scholars";
import { useLocale } from "@/lib/i18n";
import { paras, type StudyCtx } from "./study";
import { Marked } from "./Weak";
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
  const labels = labelsOf(id);
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
      {labels.creed && <span className={styles.citeLabel}>{t(`ulum.creed.${labels.creed}`)}</span>}
      {labels.fiqh && (
        <span className={styles.citeLabel}>
          {labels.fiqh === "mujtahid" ? t("ulum.fiqh.mujtahid") : t("ulum.fiqh.of", { school: t(`ulum.school.${labels.fiqh}`) })}
        </span>
      )}
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
          <span key={i}>
            <Marked text={part} />
          </span>
        ),
      )}
    </p>
  );
}

// ── long text, turned and not scrolled ──────────────────────────────────────

/** Letters to a leaf for each pixel of its width: ten lines or so of the book's type. */
const LETTERS_PER_PIXEL = 0.9;
const FEWEST_LETTERS = 240;

/** A paragraph's cut near a size, at the end of a sentence if one is near, and never inside a note. */
function cutAt(text: string, size: number): number {
  const part = text.slice(0, size);
  const sentence = Math.max(part.lastIndexOf(". "), part.lastIndexOf("؛ "), part.lastIndexOf(": "));
  let at = sentence > size * 0.5 ? sentence + 1 : part.lastIndexOf(" ");
  if (at <= 0) at = size;
  const open = text.lastIndexOf("[[", at);
  return open > text.lastIndexOf("]]", at) && open > 0 ? open : at;
}

/** Paragraphs laid out on leaves of about the same size. */
function leavesOf(lines: string[], size: number): string[][] {
  const leaves: string[][] = [[]];
  let room = size;
  // A short paragraph still takes a line and its margin.
  const line0 = size / 9;
  for (const line of lines) {
    let rest = line;
    while (rest) {
      const cost = Math.max(rest.length, line0) + line0 * 0.3;
      if (cost <= room || (rest.length <= room && !leaves[leaves.length - 1].length)) {
        leaves[leaves.length - 1].push(rest);
        room -= cost;
        break;
      }
      if (room > size * 0.3) {
        const at = cutAt(rest, room);
        leaves[leaves.length - 1].push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      leaves.push([]);
      room = size;
    }
  }
  return leaves.filter((l) => l.length);
}

/** Where a row of cards or leaves stands, and the means to move it. */
function useRail(count: number) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const sync = () => {
    const el = track.current;
    const first = el?.children[0] as HTMLElement | undefined;
    const second = el?.children[1] as HTMLElement | undefined;
    if (!el || !first) return;
    const step = second ? Math.abs(second.getBoundingClientRect().left - first.getBoundingClientRect().left) : el.clientWidth;
    setAt(Math.min(count - 1, Math.round(Math.abs(el.scrollLeft) / Math.max(1, step))));
  };
  const go = (to: number) => {
    const el = track.current;
    const child = el?.children[Math.max(0, Math.min(count - 1, to))] as HTMLElement | undefined;
    if (!el || !child) return;
    const box = el.getBoundingClientRect();
    const r = child.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: rtl ? r.right - box.right : r.left - box.left, behavior: "smooth" });
    setAt(Math.max(0, Math.min(count - 1, to)));
  };
  const onKey = (e: KeyboardEvent, rtl: boolean) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    go(at + ((e.key === "ArrowLeft") === rtl ? 1 : -1));
  };
  return { track, at, sync, go, onKey };
}

function RailBar({ at, count, go }: { at: number; count: number; go: (to: number) => void }) {
  const { t, n: num } = useLocale();
  return (
    <div className={styles.railBar}>
      <button type="button" className={styles.railBtn} onClick={() => go(at - 1)} disabled={at === 0} aria-label={t("ulum.rail.back")}>
        <span className={styles.railArrow} aria-hidden>
          ←
        </span>
      </button>
      <span className={styles.railThread} aria-hidden>
        <span style={{ transform: `scaleX(${(at + 1) / count})` }} />
      </span>
      <bdi className={styles.railCount}>{t("ulum.rail.of", { n: num(at + 1), all: num(count) })}</bdi>
      <button type="button" className={styles.railBtn} onClick={() => go(at + 1)} disabled={at === count - 1} aria-label={t("ulum.rail.on")}>
        <span className={styles.railArrow} aria-hidden>
          →
        </span>
      </button>
    </div>
  );
}

/**
 * Long text, set on leaves that turn from right to left like the pages of an Arabic
 * book, each leaf no taller than the last, so that a passage of any length stays
 * where it is on the page. A passage that fits on one leaf is just a passage.
 */
export function Leaves({ lines, lineClass, render }: { lines: string[]; lineClass?: string; render?: (line: string, i: number) => ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const seen = new ResizeObserver(() => setWidth(Math.round(el.clientWidth / 40) * 40));
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  const size = Math.max(FEWEST_LETTERS, (width || 560) * LETTERS_PER_PIXEL);
  const leaves = useMemo(() => leavesOf(lines, size), [lines, size]);
  const { track, at, sync, go, onKey } = useRail(leaves.length);
  const body = (leaf: string[]) => leaf.map((l, i) => (render ? render(l, i) : <Line key={i} text={l} className={lineClass} />));
  if (leaves.length < 2) {
    return (
      <div className={styles.bookText} ref={box}>
        {body(leaves[0] ?? [])}
      </div>
    );
  }
  return (
    <div className={styles.leaves} ref={box}>
      <div className={styles.leafTrack} ref={track} dir="rtl" tabIndex={0} onScroll={sync} onKeyDown={(e) => onKey(e, true)}>
        {leaves.map((leaf, i) => (
          <section key={i} className={styles.leaf} aria-hidden={i !== at}>
            <div className={styles.leafPage}>{body(leaf)}</div>
          </section>
        ))}
      </div>
      <div dir="rtl" className={styles.railRtl}>
        <RailBar at={at} count={leaves.length} go={go} />
      </div>
    </div>
  );
}

/** Many cards in a row to turn through, each no taller than it needs to be. */
export function Deck({ items, wide, pair }: { items: ReactNode[]; wide?: boolean; pair?: boolean }) {
  const { track, at, sync, go, onKey } = useRail(items.length);
  if (items.length < 2) return <div className={styles.deckAlone}>{items}</div>;
  return (
    <div className={wide ? styles.deckWide : pair ? styles.deckPair : styles.deck}>
      <div className={styles.deckTrack} ref={track} tabIndex={0} onScroll={sync} onKeyDown={(e) => onKey(e, getComputedStyle(e.currentTarget).direction === "rtl")}>
        {items.map((item, i) => (
          <div key={i} className={styles.deckCard}>
            {item}
          </div>
        ))}
      </div>
      <RailBar at={at} count={items.length} go={go} />
    </div>
  );
}

/**
 * A book's passage, in its own words and its own paragraphs, on leaves where it runs
 * long. Nothing in it is altered; the page marks of the printed edition are taken
 * out, as they are on the tafsir page.
 */
export function BookText({ text, lines }: { text?: string; lines?: string[] }) {
  return <Leaves lines={lines ?? paras(text ?? "")} />;
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
