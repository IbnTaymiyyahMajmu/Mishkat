"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { passage, type Passage } from "@/lib/ulum/books";
import type { Seg, SurahMorph } from "@/lib/ulum/corpus";
import type { Jumla, Remark } from "@/lib/ulum/read";
import type { Placed } from "@/lib/ulum/skeleton";

/**
 * What every chapter of the ayah study is handed: the ayah, its words, its
 * sentences, the word being studied, and the means to read a book's passage
 * on it and to say that the book was cited.
 */

export interface StudyWord {
  /** Its place in the ayah, from 1. */
  i: number;
  /** As the muṣḥaf writes it. */
  ar: string;
  tr: string;
  en: string;
  segs: Seg[];
  root: string;
  lemma: string;
  /** The sentence it is in, from 1. */
  j: number;
}

export interface Sentence {
  n: number;
  /** Its first and last word, from 1, both inclusive. */
  from: number;
  to: number;
  /** The sentence as al-Ṣāfī lists it, where one of his begins here. */
  jumla: Jumla | null;
  /** Nominal or verbal, by its first word that is not a particle. */
  kind: "nominal" | "verbal";
}

export interface StudyCtx {
  key: string;
  surah: number;
  ayah: number;
  /** How many ayat the surah has. */
  total: number;
  words: StudyWord[];
  sentences: Sentence[];
  /** The word being studied, from 1. */
  sel: number;
  pick: (i: number) => void;
  cur: StudyWord;
  sentence: Sentence;
  scholar: boolean;
  /**
   * That the books of grammar and readings could not be reached. The app reads
   * them from the site, so this is what being offline looks like there — and
   * "al-Ṣāfī gives no pattern" must not be said of a book that was not opened.
   */
  booksDown: boolean;
  morph: SurahMorph;
  translation: string;
  /** Whether a chapter has come into view — what starts its drawing. */
  seen: (id: string) => boolean;
  /** Say that a book has been cited on the page, and where. */
  cite: (id: string, where?: string) => void;
}

// ── which books the page has cited ──────────────────────────────────────────

/**
 * The colophon at the foot of the page lists every work it cites, and where.
 * Each chapter says what it cited as it shows it; the colophon listens.
 */
export function citations() {
  const seen = new Map<string, Set<string>>();
  const listeners = new Set<() => void>();
  let version = 0;
  let scheduled = false;
  const notify = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      version++;
      listeners.forEach((l) => l());
    });
  };
  return {
    cite(id: string, where = "") {
      let places = seen.get(id);
      let changed = false;
      if (!places) {
        places = new Set();
        seen.set(id, places);
        changed = true;
      }
      if (where && !places.has(where)) {
        places.add(where);
        changed = true;
      }
      if (changed) notify();
    },
    clear() {
      seen.clear();
      notify();
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    version: () => version,
    entries: () => [...seen.entries()].map(([id, places]) => ({ id, places: [...places] })),
  };
}
export type Citations = ReturnType<typeof citations>;

export function useCitations(c: Citations) {
  useSyncExternalStore(c.subscribe, c.version, () => 0);
  return c.entries();
}

// ── when a chapter is near ──────────────────────────────────────────────────

/**
 * Whether an element has come within a screen or two of being seen. A chapter
 * fetches its books only then: an ayah studied for its grammar should not
 * download eleven commentaries for the chapters below it.
 */
export function useNear(ref: RefObject<HTMLElement | null>, margin = "1400px"): boolean {
  // With no observer to ask, everything is near.
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    // The page scrolls inside its own box, and an observer of the window
    // would see a chapter only once that box showed it: the margin that lets
    // a chapter fetch its books a screen or two early is the box's.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { root: el.closest("[data-scroller]"), rootMargin: `${margin} 0px ${margin} 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, near, margin]);
  return near;
}

// ── a book's passage on the ayah ────────────────────────────────────────────

export interface Read {
  /** Still being fetched. */
  loading: boolean;
  /** The book could not be reached. */
  failed: boolean;
  /** The passage that takes in this ayah, or null where the book is silent on it. */
  p: Passage | null;
  /** The words of every ayah the passage covers, as the corpus writes them. */
  words: string[];
  /** Where this ayah's first word falls among them, from 0. */
  at0: number;
}

const NOTHING: Read = { loading: true, failed: false, p: null, words: [], at0: 0 };

/** A book's passage on this ayah, fetched once `enabled` — when its chapter is near. */
export function useBook(id: string, ctx: Pick<StudyCtx, "surah" | "ayah" | "morph">, enabled: boolean): Read {
  const key = `${id}@${ctx.surah}:${ctx.ayah}`;
  const [got, setGot] = useState<{ key: string; p: Passage | null; failed: boolean } | null>(null);
  const asked = useRef("");
  useEffect(() => {
    if (!enabled || asked.current === key) return;
    asked.current = key;
    let alive = true;
    passage(id, ctx.surah, ctx.ayah)
      .then((p) => alive && setGot({ key, p, failed: false }))
      .catch(() => alive && setGot({ key, p: null, failed: true }));
    return () => {
      alive = false;
      asked.current = "";
    };
  }, [id, key, enabled, ctx.surah, ctx.ayah]);

  return useMemo(() => {
    if (!got || got.key !== key) return NOTHING;
    if (!got.p) return { loading: false, failed: got.failed, p: null, words: [], at0: 0 };
    const words: string[] = [];
    let at0 = 0;
    for (let a = got.p.from; a <= got.p.to; a++) {
      if (a === ctx.ayah) at0 = words.length;
      for (const segs of ctx.morph.ayat[a - 1] ?? []) words.push(segs.map(([form]) => form).join(""));
    }
    return { loading: false, failed: false, p: got.p, words, at0 };
  }, [got, key, ctx.morph, ctx.ayah]);
}

/**
 * A placement in a passage's run of words, put back into this ayah: its
 * first and last word from 1, or null where it falls outside the ayah.
 */
export function local(at: Placed | null, read: Read, n: number): { from: number; to: number } | null {
  if (!at) return null;
  const from = at.from - read.at0 + 1;
  const to = at.to - read.at0 + 1;
  if (to < 1 || from > n) return null;
  return { from: Math.max(1, from), to: Math.min(n, to) };
}

/** The remarks that fall on a given word of this ayah. */
export function on<T extends { at: Placed | null }>(items: T[], read: Read, n: number, word: number): T[] {
  return items.filter((r) => {
    const l = local(r.at, read, n);
    return !!l && l.from <= word && word <= l.to;
  });
}

/** Of the remarks, those in this ayah, with where in it they fall. */
export function inAyah<T extends { at: Placed | null }>(items: T[], read: Read, n: number) {
  return items
    .map((r) => ({ r, l: local(r.at, read, n) }))
    .filter((x): x is { r: T; l: { from: number; to: number } } => !!x.l);
}

/** Whether a remark is one this ayah's study should show: in the ayah, or unplaced in a passage on it alone. */
export function belongs(r: Remark, read: Read, n: number): boolean {
  if (local(r.at, read, n)) return true;
  return !r.at && !!read.p && read.p.from === read.p.to;
}

// ── small things said often ─────────────────────────────────────────────────

const ARABIC = "٠١٢٣٤٥٦٧٨٩";
export const ar = (n: number | string) => String(n).replace(/\d/g, (d) => ARABIC[+d]);

/** Sentences of a passage cut into paragraphs, editors' notes and page marks out. */
export function paras(text: string): string[] {
  return text
    .replace(/\(p-[\d٠-٩]+\)/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
