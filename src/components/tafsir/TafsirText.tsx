"use client";

import { Fragment, useState } from "react";
import type { Para } from "@/lib/quran/types";
import { EDITOR_NOTE, SECTION_BREAK } from "@/lib/quran/tafsirApp";
import { useT, type Translate } from "@/lib/i18n";
import styles from "./Tafsir.module.css";

/**
 * A passage of tafsir, set to be read.
 *
 * The text is its author's and is not touched. What this does is typography:
 * it shows the reader, at a glance, which words on the page are whose.
 *
 *   - **The Qurʾan** being commented on is written between ﴿ and ﴾ by the
 *     editions themselves. It is set in the accent, so the eye finds the
 *     phrase under discussion and then the discussion of it — which is how a
 *     tafsir is actually read, phrase by phrase.
 *   - **The editor's footnotes** — a variant in another manuscript, a
 *     cross-reference — arrive inside the paragraph they annotate. They are a
 *     second voice, and in a critical edition a loud one: a sentence of
 *     al-Ṭabarī can carry three lines of Shākir. So they are folded to a
 *     numbered mark where each stands, as a printed page sends them to its
 *     foot, and a mark opens its note in place. A reader who wants them all
 *     set out can have that instead.
 *   - **A line of poetry**, cited as evidence for a word, has its two halves
 *     divided by an asterisk in the editions. It is centred as verse.
 *   - **The author's own headings** and the rules the edition sets between
 *     sections are kept as headings and rules.
 */

/** Qurʾanic text as the editions mark it. Split on this and the odd pieces are it. */
const QURAN = /(﴿[^﴿﴾]*﴾)/g;

/** Two hemistichs with the editions' divider between them, and nothing else. */
const VERSE_LINE = /^[^∗*\n]{6,90}\s[∗*]\s[^∗*\n]{6,90}$/;

function withQuran(text: string, key: string) {
  if (!text.includes("﴿")) return text;
  return text.split(QURAN).map((part, i) =>
    i % 2 ? (
      <span key={`${key}-${i}`} className={styles.quran}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * A run of text, cut before its last word: `[all but the word, the word]`. A
 * folded note's mark is kept on the line with that word, so that a line never
 * opens on a bare number. A word that is part of a quotation from the Qurʾan
 * is left where it is, in its quotation.
 */
function lastWord(text: string): [string, string] {
  const body = text.trimEnd();
  const cut = body.lastIndexOf(" ") + 1;
  const word = body.slice(cut);
  return !word || /[﴿﴾]/.test(word) ? [body, ""] : [body.slice(0, cut), word];
}

interface Notes {
  /** Whether a note is a mark until it is opened. */
  folded: boolean;
  /** The notes opened one at a time, by their number in the passage. */
  open: ReadonlySet<number>;
  toggle: (n: number) => void;
  t: Translate;
}

function Prose({ text, first, notes }: { text: string; first: number; notes: Notes }) {
  if (!text.includes("[[")) return <>{withQuran(text, "t")}</>;
  const pieces = text.split(EDITOR_NOTE);
  return (
    <>
      {pieces.map((part, i) => {
        if (i % 2 === 0) {
          // The word a folded note follows is set with the note's mark, below.
          const [lead] = notes.folded && i + 1 < pieces.length ? lastWord(part) : [part];
          return <Fragment key={i}>{withQuran(lead, String(i))}</Fragment>;
        }
        const n = first + (i - 1) / 2;
        const shown = !notes.folded || notes.open.has(n);
        return (
          <Fragment key={i}>
            {notes.folded && (
              <span className={styles.noteTie}>
                {lastWord(pieces[i - 1])[1]}
                <button
                  className={styles.noteMark}
                  onClick={() => notes.toggle(n)}
                  aria-expanded={shown}
                  aria-label={notes.t("tafsir.footnote", { n })}
                >
                  {n}
                </button>
              </span>
            )}
            {shown && (
              <span className={styles.editorNote} title={notes.t("tafsir.footnoteTitle")}>
                {part}
              </span>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export function TafsirText({ paras, foldNotes = false }: { paras: Para[]; foldNotes?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
  const notes: Notes = {
    folded: foldNotes,
    t,
    open,
    toggle: (n) =>
      setOpen((held) => {
        const next = new Set(held);
        if (!next.delete(n)) next.add(n);
        return next;
      }),
  };

  // The notes are numbered through the passage, not afresh in each paragraph.
  const firsts: number[] = [];
  for (let i = 0, next = 1; i < paras.length; i++) {
    firsts.push(next);
    next += countNotes(paras[i].text);
  }

  return (
    <>
      {paras.map((p, i) => {
        if (p.text === SECTION_BREAK) {
          return (
            <p key={i} className={styles.rule} aria-hidden="true">
              ٭ ٭ ٭
            </p>
          );
        }
        const kind = p.heading
          ? p.rtl
            ? styles.headingArabic
            : styles.heading
          : p.rtl && VERSE_LINE.test(p.text)
            ? styles.verseLine
            : "";
        return (
          <p
            key={i}
            dir={p.rtl ? "rtl" : "ltr"}
            lang={p.rtl ? "ar" : undefined}
            className={[styles.para, p.rtl ? styles.arabic : styles.latin, kind].filter(Boolean).join(" ")}
          >
            <Prose text={p.text} first={firsts[i]} notes={notes} />
          </p>
        );
      })}
    </>
  );
}

function countNotes(text: string): number {
  return text.includes("[[") ? (text.match(EDITOR_NOTE)?.length ?? 0) : 0;
}

/** How many editor's footnotes these paragraphs carry. */
export function countEditorNotes(paras: Para[]): number {
  return paras.reduce((n, p) => n + countNotes(p.text), 0);
}
