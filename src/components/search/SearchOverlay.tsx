"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "./SearchProvider";
import { search as runSearch, fetchVerse } from "@/lib/quran/api";
import type { SearchResult } from "@/lib/quran/types";
import { useSettings } from "@/lib/store/settings";
import { useChapters } from "@/lib/store/chapters";
import { useGoToVerse } from "@/lib/useGoToVerse";
import { isValidVerseKey, plainText, stripDiacritics } from "@/lib/text";
import styles from "./SearchOverlay.module.css";

type Scope = "all" | "quran" | "translation" | "tafsir";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "quran", label: "Qur'an text" },
  { id: "translation", label: "Translation" },
  { id: "tafsir", label: "Tafsir" },
];

const SUGGESTIONS = ["ٱلرَّحْمَـٰن", "patience", "light upon light", "2:255", "36:12"];

/** One shared empty list, so "no results" is the same reference every render. */
const NO_RESULTS: SearchResult[] = [];

export function SearchOverlay() {
  const { open, seed } = useSearch();
  // Mounted only while open, and keyed on the seed, so the dialog's state is
  // simply its initial state — nothing has to be reset when it reopens.
  if (!open) return null;
  return <SearchDialog key={seed} seed={seed} />;
}

function SearchDialog({ seed }: { seed: string }) {
  const { closeSearch } = useSearch();
  const { settings } = useSettings();
  const { byId } = useChapters();
  const goToVerse = useGoToVerse();

  const [query, setQuery] = useState(seed);
  const [scope, setScope] = useState<Scope>("all");
  const [cursor, setCursor] = useState(0);

  /**
   * The answer, stamped with the question it answers. Everything the interface
   * needs is derived from comparing the two: no separate "busy" or "searched"
   * flag to fall out of step with the results, and no state to clear when the
   * reader empties the box.
   */
  const [answer, setAnswer] = useState<{ query: string; results: SearchResult[]; total: number }>({
    query: "",
    results: [],
    total: 0,
  });

  const trimmed = query.trim();
  const idle = trimmed.length < 2;
  const settled = answer.query === trimmed;
  const results = !idle && settled ? answer.results : NO_RESULTS;
  const total = !idle && settled ? answer.total : 0;
  const busy = !idle && !settled;
  const searched = !idle && settled;

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSearch]);

  // Debounced, and cancelled by sequence number so a slow early query can never
  // land after a fast later one.
  const seq = useRef(0);
  useEffect(() => {
    const q = trimmed;
    if (q.length < 2) return;
    const mine = ++seq.current;

    const timer = setTimeout(async () => {
      // A bare reference — "2:255", "36.12" — is a lookup, not a search.
      const reference = q.match(/^(\d{1,3})\s*[:.\-]\s*(\d{1,3})$/);
      if (reference) {
        const key = `${+reference[1]}:${+reference[2]}`;
        if (isValidVerseKey(key)) {
          const verse = await fetchVerse(key, settings.translationId);
          if (seq.current !== mine) return;
          if (verse) {
            setAnswer({
              query: q,
              total: 1,
              results: [
                {
                  key: verse.verse_key,
                  arabic: verse.text_uthmani,
                  snippet: plainText(verse.translations?.[0]?.text),
                  kind: "Reference",
                },
              ],
            });
            return;
          }
        }
      }
      try {
        const res = await runSearch(q, settings.translationId);
        if (seq.current !== mine) return;
        setAnswer({ query: q, results: res.results, total: res.total });
      } catch {
        if (seq.current === mine) setAnswer({ query: q, results: [], total: 0 });
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [trimmed, settings.translationId]);

  /**
   * The corpus search returns matches from the Arabic and from the translation
   * together and does not say which. Rather than claim a scope the data cannot
   * support, the filter checks the result itself for the term.
   */
  const shown = useMemo(() => {
    if (scope === "all" || scope === "tafsir") return results;
    const needle = stripDiacritics(trimmed).toLowerCase();
    if (!needle) return results;
    return results.filter((r) => {
      const inArabic = stripDiacritics(r.arabic).includes(needle);
      const inTranslation = r.snippet.toLowerCase().includes(needle);
      return scope === "quran" ? inArabic : inTranslation;
    });
  }, [results, scope, trimmed]);

  // Clamped rather than reset in an effect: when a longer result list is
  // replaced by a shorter one the selection simply moves to the last row,
  // instead of the list rendering once with a selection that is out of range.
  const cursorIndex = Math.min(cursor, Math.max(0, shown.length - 1));

  const go = (key: string) => {
    closeSearch();
    goToVerse(key);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && shown[cursorIndex]) {
      e.preventDefault();
      go(shown[cursorIndex].key);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(shown.length - 1, cursorIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(0, cursorIndex - 1));
    }
  };

  return (
    <div className={styles.backdrop} onClick={closeSearch} role="presentation">
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search the Qur'an"
      >
        <div className={styles.head}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search Arabic, translations, or a reference like 2:255"
            aria-label="Search Arabic, translations, or a reference"
          />
          <button onClick={closeSearch} className="btn btn-icon" aria-label="Close search" style={{ width: 30, height: 30 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.scopes} role="tablist" aria-label="Search scope">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={scope === s.id}
              onClick={() => setScope(s.id)}
              className={`${styles.scope} ${scope === s.id ? styles.scopeOn : ""}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className={styles.results}>
          {scope === "tafsir" && (
            <p className={styles.notice}>
              Tafsir is served per ayah in this build but is not indexed for full-text search.
              Searching inside the tafsir corpus needs the works themselves, not an ayah-by-ayah
              API — see <code>DATA-NEEDED.md</code>.
            </p>
          )}

          {idle && (
            <div className={styles.idle}>
              <div className="kicker kicker-sm" style={{ marginBottom: 14 }}>Try</div>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => setQuery(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {busy && <div className={styles.state}>Searching…</div>}

          {!busy && searched && shown.length === 0 && scope !== "tafsir" && (
            <div className={styles.state}>
              Nothing found for that. Try an Arabic form, an English phrase, or a reference like 36:12.
            </div>
          )}

          {shown.map((r, i) => {
            const chapter = byId(Number(r.key.split(":")[0]));
            return (
              <button
                key={r.key}
                className={`${styles.result} ${i === cursorIndex ? styles.resultOn : ""}`}
                onClick={() => go(r.key)}
                onMouseEnter={() => setCursor(i)}
              >
                <span className={styles.resultHead}>
                  <span className={`tag ${r.kind === "Reference" ? "tag-neutral" : "tag-accent"}`} style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {r.kind}
                  </span>
                  <span className={styles.resultKey}>{r.key}</span>
                  <span className={styles.resultSurah}>{chapter?.name_simple ?? ""}</span>
                </span>
                <span className={`quran ${styles.resultArabic}`}>{r.arabic}</span>
                <span className={styles.resultSnippet}>{r.snippet}</span>
              </button>
            );
          })}

          {shown.length > 0 && (
            <p className={styles.footnote}>
              {scope === "all"
                ? `${total} matches across the muṣḥaf and the selected translation.`
                : `${shown.length} of ${results.length} matches contain the term in the ${scope === "quran" ? "Arabic" : "translation"}.`}{" "}
              Each result is labelled by the layer it came from.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
