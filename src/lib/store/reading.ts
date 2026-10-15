"use client";

import { useSyncExternalStore } from "react";
import { SURAH_NAMES } from "../quran/surahNames";

/**
 * What has been read, and on which day.
 *
 * The khatm plan asks how far into today's portion the reader has got, and the
 * reader's niche asks on which days anything was read at all. Both are answered
 * from this one record: for each day, the ayat that were read on it.
 *
 * An ayah is read when it has been on the screen long enough to be read — the
 * reader and the muṣḥaf view measure that (`useReadingTracker`) — or when the
 * recitation has gone past it, or when the reader says so: someone reading
 * from a printed muṣḥaf marks the day's portion as read by hand, and that
 * counts the same.
 *
 * Kept in this browser and nowhere else, like the notes and the bookmarks. A
 * day is the reader's own day, by the clock of the device they read on.
 */

const KEY = "mishkat.reading.v1";

/** Where each surah begins in a count of all 6,236 ayat, from 0. */
const OFFSET: number[] = SURAH_NAMES.reduce<number[]>((acc, s, i) => (acc.push(acc[i] + s.ayat), acc), [0]);

/** "2:255" → its place among all 6,236, from 1. */
export function ayahIndex(key: string): number {
  const [s, a] = key.split(":").map(Number);
  if (!(s >= 1 && s <= 114) || !(a >= 1 && a <= SURAH_NAMES[s - 1].ayat)) return 0;
  return OFFSET[s - 1] + a;
}

/** …and back. */
export function ayahKey(index: number): string {
  let lo = 1;
  let hi = 114;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (OFFSET[mid] < index) lo = mid + 1;
    else hi = mid;
  }
  return `${lo}:${index - OFFSET[lo - 1]}`;
}

/** The reader's day, as the date on their own clock: "2026-10-14". */
export function dayKey(at: number | Date = Date.now()): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The day so many days on from another, as a key. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** How many days lie between two day keys. */
export function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((k) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

// ── the record ──────────────────────────────────────────────────────────────

/** For each day, the ayat read on it, as runs: "1-7,255,286". */
type Stored = { v: 1; days: Record<string, string> };

export interface ReadingLog {
  /** For each day read on, the ayat read, by index. */
  days: Map<string, Set<number>>;
}

/** "1-7,255" → the ayat it names. */
export function parse(runs: string): Set<number> {
  const out = new Set<number>();
  for (const run of runs.split(",")) {
    const [a, b] = run.split("-").map(Number);
    if (!Number.isInteger(a) || a < 1 || a > 6236) continue;
    const end = Number.isInteger(b) && b >= a && b <= 6236 ? b : a;
    for (let i = a; i <= end; i++) out.add(i);
  }
  return out;
}

/** …and back. */
export function runs(set: Set<number>): string {
  const sorted = [...set].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    out.push(start === sorted[i] ? String(start) : `${start}-${sorted[i]}`);
  }
  return out.join(",");
}

const EMPTY: ReadingLog = { days: new Map() };

let cachedRaw: string | null | undefined;
let cached: ReadingLog = EMPTY;
/**
 * Bumped whenever what is waiting changes. The snapshot is rebuilt only when
 * this or the stored record has moved: React asks for it on every render and
 * must be handed the same object back while nothing has.
 */
let version = 0;
let cachedVersion = 0;
/** Read since the last write, waiting to be kept: written a few seconds at a time, not on every ayah. */
const pending = new Map<string, Set<number>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function load(): ReadingLog {
  const raw = readRaw();
  if (raw === cachedRaw && version === cachedVersion) return cached;
  let stored: Stored | null = null;
  try {
    const parsed = raw ? (JSON.parse(raw) as Stored) : null;
    stored = parsed && typeof parsed === "object" && parsed.days ? parsed : null;
  } catch {
    stored = null; // hand-edited into nonsense; start again rather than break the page
  }
  const days = new Map<string, Set<number>>();
  for (const [day, value] of Object.entries(stored?.days ?? {})) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && typeof value === "string") days.set(day, parse(value));
  }
  for (const [day, set] of pending) {
    const held = days.get(day) ?? new Set<number>();
    for (const i of set) held.add(i);
    days.set(day, held);
  }
  cachedRaw = raw;
  cachedVersion = version;
  cached = { days };
  return cached;
}

function flush() {
  flushTimer = null;
  if (!pending.size) return;
  const log = load();
  const days: Record<string, string> = {};
  for (const [day, set] of log.days) if (set.size) days[day] = runs(set);
  try {
    const raw = JSON.stringify({ v: 1, days } satisfies Stored);
    localStorage.setItem(KEY, raw);
    pending.clear();
    cachedRaw = raw;
  } catch {
    /* storage refused: what was read is held for the visit and tried again */
  }
}

function notify() {
  for (const l of listeners) l();
}

/** Note that these ayat were read — today, unless another day is given. */
export function noteRead(indexes: number[], day = dayKey()) {
  const valid = indexes.filter((i) => Number.isInteger(i) && i >= 1 && i <= 6236);
  if (!valid.length) return;
  const known = load().days.get(day);
  const fresh = valid.filter((i) => !known?.has(i));
  if (!fresh.length) return;
  const set = pending.get(day) ?? new Set<number>();
  for (const i of fresh) set.add(i);
  pending.set(day, set);
  version++; // the pending set is part of the snapshot
  if (!flushTimer) flushTimer = setTimeout(flush, 2500);
  notify();
}

/**
 * Take back ayat noted as read on a day: a portion marked read by hand, by
 * mistake. What is waiting is kept first, so the record taken from is whole.
 */
export function forgetRead(indexes: number[], day = dayKey()) {
  if (flushTimer) clearTimeout(flushTimer);
  flush();
  const log = load();
  const held = log.days.get(day);
  if (!held) return;
  const drop = new Set(indexes);
  const days: Record<string, string> = {};
  for (const [d, set] of log.days) {
    const kept = d === day ? new Set([...set].filter((i) => !drop.has(i))) : set;
    if (kept.size) days[d] = runs(kept);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, days } satisfies Stored));
  } catch {
    return; // storage refused: nothing was taken back, and the screen still says so
  }
  cachedRaw = undefined;
  notify();
}

/** Note one ayah by its key: "2:255". */
export function noteReadKey(key: string) {
  const i = ayahIndex(key);
  if (i) noteRead([i]);
}

if (typeof window !== "undefined") {
  // Whatever is still waiting is kept before the page goes away.
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The whole record, kept in step with every tab. */
export function useReadingLog(): ReadingLog {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

/** Every ayah read on or after a day, from the record. */
export function readSince(log: ReadingLog, from: string): Set<number> {
  const out = new Set<number>();
  for (const [day, set] of log.days) if (day >= from) for (const i of set) out.add(i);
  return out;
}
