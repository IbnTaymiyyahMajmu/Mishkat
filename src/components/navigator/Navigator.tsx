"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChapters } from "@/lib/store/chapters";
import { useLibrary } from "@/lib/store/library";
import { readStops } from "@/lib/store/stops";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { NAMED } from "@/lib/quran/marks";
import { juzStartsIn } from "@/lib/quran/juz";
import { resolveGoto, type Destination, type SurahRow } from "@/lib/quran/goto";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import styles from "./Navigator.module.css";

/**
 * Going somewhere, from wherever you are.
 *
 * The rail down the side of the reader is how a surah is moved through on a
 * wide screen, and a phone has no room for it — which left a phone with one
 * way to reach ayah 200, and that was to scroll past the 199 before it. Going
 * to another surah meant leaving the reader altogether.
 *
 * This is the whole muṣḥaf within a thumb's reach of any ayah, and it answers
 * in two ways because there are two kinds of asking. Someone who knows the
 * number types it: `11` is the ayah, `2 255` the Throne Verse, `kahf` the
 * surah, `juz 30` the last part. Someone who does not picks: every surah is
 * listed on one side, and the surah picked is laid out on the other as its
 * ayat, each one a place to tap. Nothing is fetched to draw any of it — the
 * table of surahs is baked into the build — so it opens at once and it works
 * without a connection.
 *
 * The ayat are not a bare grid of numbers. The reader's own marks are on it:
 * the ayah they are at, the ones they bookmarked or wrote on, and in the list
 * of surahs, how far they got in each one they have been reading. A number is
 * easier to find when it is next to something you recognise.
 */

interface Props {
  /** The surah that is open, and the ayah the reader has got to in it. */
  surah: number;
  ayah: number;
  /** `ayah` null is the head of the surah. */
  onGo: (surah: number, ayah: number | null) => void;
  onClose: () => void;
}

interface Row extends SurahRow {
  meccan: boolean;
}

const KIND: Record<Destination["kind"], MessageKey> = {
  ayah: "common.ayah",
  surah: "common.surah",
  juz: "common.juz",
};

/**
 * Bring one row of a scrolling pane to its middle, or go to its top if there
 * is no such row. By arithmetic rather than with `scrollIntoView`, which would
 * move every scrolling ancestor as well.
 */
function centre(box: HTMLElement | null, selector: string) {
  if (!box) return;
  const el = box.querySelector<HTMLElement>(selector);
  box.scrollTop = el ? el.offsetTop - (box.clientHeight - el.offsetHeight) / 2 : 0;
}

export function Navigator({ surah, ayah, onGo, onClose }: Props) {
  const { chapters } = useChapters();
  const { bookmarks, notes } = useLibrary();
  const { t, rich, arrows } = useLocale();
  const names = useSurahNames();

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(surah);
  const [cursor, setCursor] = useState(0);
  // Read once, as the sheet opens: where the reader stopped in each surah.
  const [stops] = useState(() => readStops());

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const ayatRef = useRef<HTMLDivElement>(null);

  // The live chapter table when it has landed; the baked-in one until then,
  // and for good if the corpus cannot be reached.
  const rows = useMemo<Row[]>(
    () =>
      chapters.length > 0
        ? chapters.map((c) => ({
            id: c.id,
            english: c.name_simple,
            arabic: c.name_arabic,
            meaning: c.translated_name?.name ?? "",
            ayat: c.verses_count,
            meccan: c.revelation_place === "makkah",
          }))
        : SURAH_NAMES.map((s, i) => ({
            id: i + 1,
            english: s.english,
            arabic: s.arabic,
            meaning: s.meaning,
            ayat: s.ayat,
            meccan: s.place === "makkah",
          })),
    [chapters],
  );

  const row = rows[picked - 1] ?? rows[0];
  const typing = query.trim().length > 0;
  const answers = useMemo(
    () => resolveGoto(query, rows, picked, { t, name: names.name, meaning: names.meaning }),
    [query, rows, picked, t, names],
  );
  const cursorIndex = Math.min(cursor, Math.max(0, answers.length - 1));

  // ── the reader's own marks on the surah picked ────────────────────────────
  const marks = useMemo(() => {
    const saved = new Set<number>();
    const noted = new Set<number>();
    for (const b of bookmarks) if (b.surah === picked) saved.add(Number(b.verseKey.split(":")[1]));
    for (const n of notes) {
      if (n.surah === picked && n.verseKey) noted.add(Number(n.verseKey.split(":")[1]));
    }
    return { saved, noted };
  }, [bookmarks, notes, picked]);

  const stop = picked === surah ? null : (stops[picked] ?? null);

  /** The places in this surah that have a name, ahead of the numbers. */
  const shortcuts = useMemo(() => {
    const out: { ayah: number; label: string }[] = [];
    if (stop && stop <= row.ayat) out.push({ ayah: stop, label: t("goto.shortcutStopped") });
    for (const [key, label] of Object.entries(NAMED)) {
      const [s, a] = key.split(":").map(Number);
      // At the head of a surah the name is the surah's own, and says nothing.
      if (s === picked && a > 1 && a <= row.ayat) out.push({ ayah: a, label: t(label).split(" — ")[0] });
    }
    for (const j of juzStartsIn(picked)) {
      if (j.ayah > 1) out.push({ ayah: j.ayah, label: t("goto.shortcutJuz", { n: j.n }) });
    }
    return out.sort((x, y) => x.ayah - y.ayah);
  }, [picked, row.ayat, stop, t]);

  // ── opening ───────────────────────────────────────────────────────────────
  useEffect(() => {
    // The keyboard is offered where there is one. On a phone it would rise
    // over half the sheet before anything had been asked for, and the sheet is
    // built to be used without it: the ayat are there to be tapped.
    if (window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // On top of everything else, so Escape is this sheet's to answer.
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Both panes open on what they are about: the list at the surah in hand, the
  // ayat at the one the reader is on.
  useEffect(() => {
    if (!typing) centre(listRef.current, `[data-surah="${surah}"]`);
  }, [typing, surah]);

  useEffect(() => {
    if (typing) return;
    centre(ayatRef.current, picked === surah ? `[data-ayah="${ayah}"]` : `[data-ayah="${stop ?? 0}"]`);
  }, [typing, picked, surah, ayah, stop]);

  const go = (d: Destination | undefined) => {
    if (d) onGo(d.surah, d.ayah);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(answers.length - 1, cursorIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(0, cursorIndex - 1));
    }
  };

  const place = (n: number): string =>
    [
      t("common.ayahN", { n }),
      picked === surah && n === ayah ? t("goto.here") : "",
      n === stop ? t("goto.stopped") : "",
      marks.saved.has(n) ? t("goto.bookmarked") : "",
      marks.noted.has(n) ? t("goto.noted") : "",
    ]
      .filter(Boolean)
      .join(", ");

  const anyMarked = marks.saved.size > 0 || marks.noted.size > 0;

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("goto.dialog")}
      >
        <form
          className={styles.head}
          onSubmit={(e) => {
            e.preventDefault();
            go(answers[cursorIndex]);
          }}
        >
          <svg className={styles.headIcon} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="m15.5 8.5-2 5-5 2 2-5z" />
          </svg>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t("goto.placeholder")}
            aria-label={t("goto.input")}
            enterKeyHint="go"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
          {query.length > 0 && (
            <button
              type="button"
              className={styles.clear}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label={t("common.clear")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M17 7 7 17" />
                <path d="m7 7 10 10" />
              </svg>
            </button>
          )}
          <button type="button" onClick={onClose} className={styles.close}>
            {t("common.close")}
          </button>
        </form>

        {typing ? (
          <div className={styles.answers}>
            {answers.length === 0 && (
              <p className={styles.none}>
                {t("goto.none")}
                <br />
                {rich("goto.noneTry", { b: (words) => <b>{words}</b> }, { surah: names.name(row.id) })}
              </p>
            )}
            {answers.map((d, i) => (
              <button
                key={`${d.kind}-${d.surah}-${d.ayah}`}
                className={`${styles.answer} ${i === cursorIndex ? styles.answerOn : ""}`}
                onClick={() => go(d)}
                onMouseEnter={() => setCursor(i)}
              >
                <span className={styles.answerKind}>{t(KIND[d.kind])}</span>
                <span className={styles.answerText}>
                  <span className={styles.answerTitle}>{d.title}</span>
                  <span className={styles.answerDetail}>{d.detail}</span>
                </span>
                {!names.arabic && (
                  <span className={styles.answerArabic} dir="rtl">
                    {rows[d.surah - 1]?.arabic}
                  </span>
                )}
                {i === cursorIndex && <span className={styles.answerGo}>↵ {t("goto.go")}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.browse}>
            <div className={styles.surahs} ref={listRef} role="listbox" aria-label={t("goto.surahs")}>
              {rows.map((r) => {
                const at = r.id === surah ? ayah : stops[r.id];
                return (
                  <button
                    key={r.id}
                    role="option"
                    aria-selected={picked === r.id}
                    data-surah={r.id}
                    className={`${styles.surah} ${picked === r.id ? styles.surahOn : ""}`}
                    onClick={() => setPicked(r.id)}
                  >
                    <span className={styles.surahNum}>{r.id}</span>
                    <span className={styles.surahText}>
                      <span className={`${styles.surahName} ${names.arabic ? styles.surahNameArabic : ""}`}>
                        {names.name(r.id)}
                      </span>
                      <span className={`${styles.surahSub} ${at ? styles.surahAt : ""}`}>
                        {r.id === surah
                          ? t("goto.reading", { ayah, total: r.ayat })
                          : at
                            ? t("goto.stoppedAt", { ayah: at, total: r.ayat })
                            : t("common.ayat", { count: r.ayat })}
                      </span>
                    </span>
                    {!names.arabic && <span className={styles.surahArabic}>{r.arabic}</span>}
                  </button>
                );
              })}
            </div>

            <div className={styles.ayat} ref={ayatRef}>
              <div className={styles.ayatHead}>
                <div className={styles.ayatTitle}>
                  <div className={styles.ayatName}>
                    {names.arabic ? (
                      <span className={styles.ayatNameArabic}>{row.arabic}</span>
                    ) : (
                      <>
                        {names.name(row.id)}
                        <span className={styles.ayatArabic}>{row.arabic}</span>
                      </>
                    )}
                  </div>
                  <div className={styles.ayatSub}>
                    {names.meaning(row.id) && <span className={styles.ayatMeaning}>{names.meaning(row.id)} · </span>}
                    {t("common.ayat", { count: row.ayat })} · {t(row.meccan ? "common.meccan" : "common.medinan")}
                  </div>
                </div>
                <button
                  className={`btn ${picked === surah ? "btn-secondary" : "btn-primary"} ${styles.open}`}
                  onClick={() => onGo(picked, null)}
                >
                  {picked === surah ? t("goto.toTop") : `${t("goto.openSurah")} ${arrows.next}`}
                </button>
              </div>

              {shortcuts.length > 0 && (
                <div className={styles.shortcuts}>
                  {shortcuts.map((s) => (
                    <button
                      key={`${s.ayah}-${s.label}`}
                      className={styles.shortcut}
                      onClick={() => onGo(picked, s.ayah)}
                    >
                      <span className={styles.shortcutAyah}>{s.ayah}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.grid} role="group" aria-label={t("goto.ayatOf", { surah: names.name(row.id) })}>
                {Array.from({ length: row.ayat }, (_, i) => i + 1).map((n) => {
                  const here = picked === surah && n === ayah;
                  return (
                    <button
                      key={n}
                      data-ayah={n}
                      className={[styles.cell, here && styles.cellHere, n === stop && styles.cellStop]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => onGo(picked, n)}
                      aria-label={place(n)}
                      aria-current={here ? "location" : undefined}
                    >
                      {n}
                      {(marks.saved.has(n) || marks.noted.has(n)) && <span className={styles.dot} />}
                    </button>
                  );
                })}
              </div>

              {(anyMarked || picked === surah || stop) && (
                <div className={styles.legend}>
                  {picked === surah && (
                    <span>
                      <i className={`${styles.key} ${styles.keyHere}`} /> {t("goto.here")}
                    </span>
                  )}
                  {stop && (
                    <span>
                      <i className={`${styles.key} ${styles.keyStop}`} /> {t("goto.stopped")}
                    </span>
                  )}
                  {anyMarked && (
                    <span>
                      <i className={`${styles.key} ${styles.keyDot}`} /> {t("goto.marked")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.foot}>
          <span className={styles.footNote}>
            {typing
              ? answers.length
                ? t("goto.footFirst")
                : t("goto.footKinds")
              : t("goto.footBrowse")}
          </span>
          <span className={styles.keys}>
            <kbd className={styles.kbd}>↵</kbd>
            {t("keys.go")}
            <kbd className={styles.kbd}>esc</kbd>
            {t("keys.close")}
          </span>
        </div>
      </div>
    </div>
  );
}
