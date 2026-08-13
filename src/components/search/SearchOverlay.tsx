"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "./SearchProvider";
import { search as runSearch, fetchVerse } from "@/lib/quran/api";
import type { Chapter, SearchResult } from "@/lib/quran/types";
import { useSettings } from "@/lib/store/settings";
import { useChapters } from "@/lib/store/chapters";
import { useRecentSearches } from "@/lib/store/recent";
import { useGoToVerse } from "@/lib/useGoToVerse";
import { isValidVerseKey, plainText } from "@/lib/text";
import { foldToText, markMatches, type MatchPart } from "@/lib/match";
import styles from "./SearchOverlay.module.css";

type Scope = "all" | "quran" | "translation" | "tafsir";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "quran", label: "Qur'an text" },
  { id: "translation", label: "Translation" },
  { id: "tafsir", label: "Tafsir" },
];

const SUGGESTIONS = ["ٱلرَّحْمَـٰن", "patience", "light upon light", "Maryam", "2:255"];

/** How the search box reads a query, shown while the box is empty. */
const GRAMMAR: { term: string; means: string }[] = [
  { term: "2:255", means: "jump straight to an ayah" },
  { term: "Maryam", means: "open a surah by name or number" },
  { term: "ٱلرَّحْمَـٰن", means: "Arabic, diacritics optional" },
  { term: "light upon light", means: "search the translation" },
];

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
  const { chapters, byId } = useChapters();
  const { recent, remember, clear: clearRecent } = useRecentSearches();
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
  const resultsRef = useRef<HTMLDivElement>(null);

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
            remember(q);
            return;
          }
        }
      }
      try {
        const res = await runSearch(q, settings.translationId);
        if (seq.current !== mine) return;
        setAnswer({ query: q, results: res.results, total: res.total });
        // Only a query that found something is worth offering back.
        if (res.results.length) remember(q);
      } catch {
        if (seq.current === mine) setAnswer({ query: q, results: [], total: 0 });
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [trimmed, settings.translationId, remember]);

  /**
   * The corpus search returns matches from the Arabic and from the translation
   * together and does not say which. Rather than claim a scope the data cannot
   * support, the filter checks the result itself for the term — folded, so a
   * query typed without diacritics still matches fully-pointed Qur'anic text.
   */
  const needle = useMemo(() => foldToText(trimmed), [trimmed]);

  const counts = useMemo(() => {
    const inArabic = (r: SearchResult) => !!needle && foldToText(r.arabic).includes(needle);
    const inTranslation = (r: SearchResult) => !!needle && foldToText(r.snippet).includes(needle);
    return {
      all: results.length,
      quran: results.filter(inArabic).length,
      translation: results.filter(inTranslation).length,
      tafsir: 0,
    } satisfies Record<Scope, number>;
  }, [results, needle]);

  const shown = useMemo(() => {
    if (scope === "tafsir") return NO_RESULTS;
    if (scope === "all" || !needle) return results;
    return results.filter((r) => {
      const where = scope === "quran" ? r.arabic : r.snippet;
      return foldToText(where).includes(needle);
    });
  }, [results, scope, needle]);

  /** A surah named, or numbered, rather than a phrase to look for. */
  const chapterHits = useMemo(() => {
    if (idle) return [] as Chapter[];
    const matches = (c: Chapter) => {
      if (String(c.id) === trimmed) return true;
      if (needle.length < 3) return false;
      return (
        foldToText(c.name_simple).includes(needle) ||
        foldToText(c.name_arabic).includes(needle) ||
        foldToText(c.translated_name?.name ?? "").includes(needle)
      );
    };
    return chapters.filter(matches).slice(0, 4);
  }, [chapters, idle, trimmed, needle]);

  // Clamped rather than reset in an effect: when a longer result list is
  // replaced by a shorter one the selection simply moves to the last row,
  // instead of the list rendering once with a selection that is out of range.
  const cursorIndex = Math.min(cursor, Math.max(0, shown.length - 1));

  // Keep the selected row in view when it is moved by the keyboard.
  useEffect(() => {
    const box = resultsRef.current;
    const row = box?.querySelector<HTMLElement>(`[data-row="${cursorIndex}"]`);
    if (!box || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = Math.max(0, top - 10);
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 10;
  }, [cursorIndex]);

  const go = (key: string) => {
    closeSearch();
    goToVerse(key);
  };

  const ask = (q: string) => {
    setQuery(q);
    setCursor(0);
    inputRef.current?.focus();
  };

  const clearQuery = () => {
    // Retire any flight in progress, or its answer lands in an empty box.
    seq.current++;
    setQuery("");
    setAnswer({ query: "", results: [], total: 0 });
    setCursor(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(shown.length - 1, cursorIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(0, cursorIndex - 1));
    } else if (e.key === "Home" && shown.length) {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === "End" && shown.length) {
      e.preventDefault();
      setCursor(shown.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = shown[cursorIndex];
      if (row) go(row.key);
      else if (chapterHits[0]) go(`${chapterHits[0].id}:1`);
    }
  };

  const empty = searched && shown.length === 0 && chapterHits.length === 0 && scope !== "tafsir";

  const note = idle
    ? "Type two letters or more"
    : busy
      ? "Searching…"
      : scope === "all"
        ? `${total} matches in the muṣḥaf and the selected translation`
        : scope === "tafsir"
          ? "Tafsir is not indexed for full-text search"
          : `${shown.length} of ${results.length} carry the term in the ${scope === "quran" ? "Arabic" : "translation"}`;

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
          <svg className={styles.headIcon} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
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
            placeholder="Search Arabic, an English phrase, a surah name, or 2:255"
            aria-label="Search Arabic, translations, or a reference"
          />
          {query.length > 0 && (
            <button onClick={clearQuery} className={styles.clear} aria-label="Clear search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M15 9 9 15" />
                <path d="m9 9 6 6" />
              </svg>
            </button>
          )}
          <span className={styles.headRule} aria-hidden="true" />
          <button onClick={closeSearch} className={styles.esc} aria-label="Close search">
            Esc
          </button>
        </div>

        <div className={styles.scopes} role="group" aria-label="Search scope">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              aria-pressed={scope === s.id}
              onClick={() => {
                setScope(s.id);
                setCursor(0);
              }}
              className={`${styles.scope} ${scope === s.id ? styles.scopeOn : ""}`}
            >
              <span>{s.label}</span>
              {searched && s.id !== "tafsir" && (
                <span className={styles.scopeCount}>{counts[s.id]}</span>
              )}
            </button>
          ))}
        </div>

        <div className={styles.results} ref={resultsRef}>
          {chapterHits.length > 0 && (
            <div className={styles.chapters}>
              <div className={styles.sectionLabel}>Surahs</div>
              {chapterHits.map((c) => (
                <button key={c.id} className={styles.chapter} onClick={() => go(`${c.id}:1`)}>
                  <span className={styles.chapterNum}>{c.id}</span>
                  <span className={styles.chapterText}>
                    <span className={styles.chapterName}>{c.name_simple}</span>
                    <span className={styles.chapterSub}>
                      {c.translated_name?.name ? `${c.translated_name.name} · ` : ""}
                      {c.verses_count} ayat ·{" "}
                      {c.revelation_place === "makkah" ? "Meccan" : "Medinan"}
                    </span>
                  </span>
                  <span className={styles.chapterArabic} dir="rtl">
                    {c.name_arabic}
                  </span>
                </button>
              ))}
            </div>
          )}

          {idle && (
            <div className={styles.idle}>
              {recent.length > 0 && (
                <div className={styles.block}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionLabel}>Recent</span>
                    <span className={styles.sectionRule} />
                    <button onClick={clearRecent} className={styles.clearRecent}>
                      Clear
                    </button>
                  </div>
                  <div className={styles.chips}>
                    {recent.map((r) => (
                      <button key={r} className={styles.chip} onClick={() => ask(r)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 2" />
                        </svg>
                        <span>{r}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>Try</span>
                <span className={styles.sectionRule} />
              </div>
              <div className={styles.chips}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className={styles.chip} onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>

              <div className={styles.grammar}>
                {GRAMMAR.map((g) => (
                  <div key={g.term}>
                    <span className={styles.grammarTerm}>{g.term}</span> — {g.means}
                  </div>
                ))}
              </div>
            </div>
          )}

          {scope === "tafsir" && !idle && (
            <p className={styles.notice}>
              Tafsir is served per ayah in this build but is not indexed for full-text search — the
              corpus itself, not an ayah-by-ayah API, is what that would need.
            </p>
          )}

          {busy && (
            <div className={styles.state}>
              <div className={styles.spinner} aria-hidden="true">
                ۞
              </div>
              <div className={styles.stateText}>Searching the muṣḥaf…</div>
            </div>
          )}

          {empty && (
            <div className={styles.state}>
              <div className={styles.stateText}>
                Nothing found for that.
                <br />
                Try an Arabic form without diacritics, an English phrase, or a reference like 36:12.
              </div>
            </div>
          )}

          {shown.map((r, i) => {
            const chapter = byId(Number(r.key.split(":")[0]));
            const active = i === cursorIndex;
            return (
              <button
                key={r.key}
                data-row={i}
                className={`${styles.result} ${active ? styles.resultOn : ""}`}
                onClick={() => go(r.key)}
                onMouseEnter={() => setCursor(i)}
              >
                <span className={styles.resultHead}>
                  <span
                    className={`${styles.badge} ${r.kind === "Reference" ? styles.badgeNeutral : styles.badgeAccent}`}
                  >
                    {r.kind}
                  </span>
                  <span className={styles.resultKey}>{r.key}</span>
                  <span className={styles.resultSurah}>{chapter?.name_simple ?? ""}</span>
                  <span className={styles.resultGap} />
                  <span className={styles.openHint}>↵ Open</span>
                </span>
                <span className={styles.resultArabic} dir="rtl">
                  <Marked text={r.arabic} needle={needle} />
                </span>
                <span className={styles.resultSnippet}>
                  <Marked text={r.snippet} needle={needle} />
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.foot}>
          <span className={styles.footNote}>{note}</span>
          <span className={styles.resultGap} />
          <span className={styles.key}>
            <kbd className={styles.kbd}>↑↓</kbd>move
          </span>
          <span className={styles.key}>
            <kbd className={styles.kbd}>↵</kbd>open
          </span>
          <span className={styles.key}>
            <kbd className={styles.kbd}>esc</kbd>close
          </span>
        </div>
      </div>
    </div>
  );
}

/** The reader's term lit up inside the text it was found in. */
function Marked({ text, needle }: { text: string; needle: string }) {
  const parts: MatchPart[] = useMemo(() => markMatches(text, needle), [text, needle]);
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className={styles.hit}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
