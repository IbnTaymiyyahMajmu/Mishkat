"use client";

import { useCallback, useMemo, useState } from "react";
import { fetchFootnote } from "@/lib/quran/api";
import { parseTranslation, plainNote, readsRightToLeft } from "@/lib/quran/translations";
import { useT } from "@/lib/i18n";
import styles from "./Translation.module.css";

interface Props {
  /** The translation as the corpus sent it, markup and all. */
  text: string;
  /** Its footnotes, by id, where they came with it. Any that did not are asked for when opened. */
  footnotes?: Record<string, string>;
  /** `"en"`, `"ur"`. Empty when it is not known, which turns hyphenation off rather than guessing. */
  lang?: string;
  /** The paragraph's class, from wherever it is being set. */
  className?: string;
}

/**
 * A translation, set as its translator wrote it.
 *
 * A translation of the Qur'an is not only its sentences. The translator's
 * footnotes say what a word was chosen over, who "We" is, which reading of the
 * Arabic the English follows; the words in italics are the ones he added to
 * make the English stand. The site used to strip all of that and print what
 * was left, which is the translation with the translator's hand taken out.
 *
 * So the marks stay in the text, and each opens its note in place, under the
 * ayah it belongs to — not at the foot of a page that a screen does not have,
 * and not in a box over the text being read.
 */
export function TranslationText({ text, footnotes, lang, className }: Props) {
  const t = useT();
  const pieces = useMemo(() => parseTranslation(text), [text]);
  const rtl = useMemo(() => readsRightToLeft(pieces), [pieces]);
  const [open, setOpen] = useState<string[]>([]);
  /** Notes that had to be asked for. `null` is one that could not be had. */
  const [fetched, setFetched] = useState<Record<string, string | null>>({});

  const toggle = useCallback(
    (id: string) => {
      setOpen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
      // A note that did not come with the text is asked for the first time it
      // is wanted. Asking twice is one request: the corpus client sees to that.
      if (footnotes?.[id] != null || id in fetched) return;
      fetchFootnote(id).then(
        (note) => setFetched((f) => ({ ...f, [id]: note })),
        () => setFetched((f) => ({ ...f, [id]: null })),
      );
    },
    [footnotes, fetched],
  );

  // In the order they stand in the text, whatever order they were opened in.
  const notes = pieces.filter((p) => p.kind === "note" && open.includes(p.id));

  return (
    <>
      <p
        className={`${styles.text} ${className ?? ""} ${rtl ? styles.rtl : ""}`}
        dir={rtl ? "rtl" : "ltr"}
        lang={lang ?? ""}
        translate="no"
      >
        {pieces.map((p, i) =>
          p.kind === "text" ? (
            p.supplied ? (
              <i key={i} className={styles.supplied}>
                {p.text}
              </i>
            ) : (
              p.text
            )
          ) : p.kind === "mark" ? (
            <sup key={i} className={styles.mark}>
              {p.text}
            </sup>
          ) : (
            <button
              key={i}
              type="button"
              className={`${styles.note} ${open.includes(p.id) ? styles.noteOn : ""}`}
              aria-expanded={open.includes(p.id)}
              aria-label={t("translations.footnote", { mark: p.mark })}
              onClick={() => toggle(p.id)}
            >
              {p.mark}
            </button>
          ),
        )}
      </p>

      {notes.length > 0 && (
        <ol className={styles.notes} aria-label={t("translations.footnotes")}>
          {notes.map((p) => {
            if (p.kind !== "note") return null;
            const raw = footnotes?.[p.id] ?? fetched[p.id];
            return (
              // The row runs the way its note does, so the mark stands at the
              // head of the note rather than at its far end.
              <li key={p.id} className={styles.noteRow} dir={rtl ? "rtl" : "ltr"}>
                <button
                  type="button"
                  className={styles.noteMark}
                  onClick={() => toggle(p.id)}
                  aria-label={t("translations.closeFootnote", { mark: p.mark })}
                  title={t("common.close")}
                >
                  {p.mark}
                </button>
                <span
                  className={`${styles.noteText} ${rtl ? styles.rtl : ""}`}
                  dir={rtl ? "rtl" : "ltr"}
                  lang={lang ?? ""}
                  translate="no"
                >
                  {raw === null
                    ? t("translations.noteUnreached")
                    : raw === undefined
                      ? "…"
                      : plainNote(raw)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
