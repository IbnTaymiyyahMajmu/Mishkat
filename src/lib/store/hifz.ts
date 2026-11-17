"use client";

import { useSyncExternalStore } from "react";
import { createPersistedStore } from "./persisted";
import { addDays, ayahKey, dayKey } from "./reading";

/**
 * What the reader keeps by heart, and when each ayah of it should be recited
 * again.
 *
 * The site could already help someone memorise — a passage looped from the
 * transport, each ayah as many times as asked — and then forgot that they had.
 * Memorising is the smaller half of the work: what is not gone back to is
 * lost, and the going back is what nobody keeps count of on their own. This is
 * the count.
 *
 * Each ayah kept has a strength, and a day it is due. Recited without help, it
 * grows a step stronger and is left alone for longer — a day, then two, four,
 * a week, two weeks, a month, two months. Faltered on, it steps back and is
 * asked for tomorrow. Forgotten, it starts again. Nothing here judges the
 * recitation: the reader recites, uncovers the ayah, and says how it went.
 *
 * Kept in this browser and nowhere else, like the notes and the days read.
 */

/** How long an ayah is left alone after it is recited well, by the strength it then has. */
export const STEPS = [0, 1, 2, 4, 7, 14, 30, 60] as const;
export const STRONGEST = STEPS.length - 1;
/** From here up an ayah has been held across a fortnight and more. */
export const FIRM = 5;
/** No more than this many ayat in one sitting: past it, a sitting is a chore. */
export const SITTING = 40;

export type Grade = "knew" | "faltered" | "forgot";

export interface Kept {
  /** 0 is an ayah being learned or lost again; `STRONGEST` is one recited across months. */
  strength: number;
  /** The day it is next to be recited, as a day key: "2026-11-17". */
  due: string;
  /** How many times it has been recited and judged. */
  times: number;
  /** The words slipped on the last time, by their place in the ayah from 1. */
  slips: number[];
}

/** For each ayah kept, by its place among the 6,236: strength, day due, times, and the last slips. */
type Row = [strength: number, due: string, times: number, ...slips: number[]];
type Stored = { v: 1; ayat: Record<string, Row> };

export type Hifz = ReadonlyMap<number, Kept>;

const EMPTY: Hifz = new Map();
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function revive(stored: unknown): Hifz {
  if (!stored || typeof stored !== "object") return EMPTY;
  const ayat = (stored as Partial<Stored>).ayat;
  if (!ayat || typeof ayat !== "object") return EMPTY;
  const out = new Map<number, Kept>();
  for (const [at, row] of Object.entries(ayat)) {
    const index = Number(at);
    if (!Number.isInteger(index) || index < 1 || index > 6236 || !Array.isArray(row)) continue;
    const [strength, due, times, ...slips] = row as unknown[];
    if (typeof due !== "string" || !DAY.test(due)) continue;
    out.set(index, {
      strength: Math.min(STRONGEST, Math.max(0, Math.round(Number(strength)) || 0)),
      due,
      times: Math.max(0, Math.round(Number(times)) || 0),
      slips: slips.filter((s): s is number => Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 400).slice(0, 60),
    });
  }
  return out;
}

/**
 * The store keeps the map itself and writes it as rows. `createPersistedStore`
 * serialises whatever it is handed, and a Map serialises to `{}` — so the map
 * is given a `toJSON` that writes the rows, and reading goes through `revive`.
 */
function writable(map: Map<number, Kept>): Hifz {
  Object.defineProperty(map, "toJSON", {
    enumerable: false,
    value(): Stored {
      const ayat: Stored["ayat"] = {};
      for (const [index, k] of map) ayat[index] = [k.strength, k.due, k.times, ...k.slips];
      return { v: 1, ayat };
    },
  });
  return map;
}

const store = createPersistedStore<Hifz>("mishkat.hifz.v1", EMPTY, revive);

/** What stands after an ayah of this strength is judged, on this day. */
export function judged(before: Kept | undefined, grade: Grade, slips: number[], today = dayKey()): Kept {
  const was = before?.strength ?? 0;
  const strength =
    grade === "knew" ? Math.min(STRONGEST, was + 1) : grade === "faltered" ? Math.max(1, was - 1) : 0;
  const wait = grade === "knew" ? STEPS[strength] : grade === "faltered" ? 1 : 0;
  return {
    strength,
    due: addDays(today, wait),
    times: (before?.times ?? 0) + 1,
    slips: [...new Set(slips)].sort((a, b) => a - b).slice(0, 60),
  };
}

/** How many days on an ayah would next be asked for, were it judged so. */
export function waitAfter(before: Kept | undefined, grade: Grade): number {
  if (grade === "forgot") return 0;
  if (grade === "faltered") return 1;
  return STEPS[Math.min(STRONGEST, (before?.strength ?? 0) + 1)];
}

/** Record how an ayah went. */
export function grade(index: number, how: Grade, slips: number[]): void {
  if (!Number.isInteger(index) || index < 1 || index > 6236) return;
  const next = new Map(store.getSnapshot());
  next.set(index, judged(next.get(index), how, slips));
  store.set(writable(next));
}

/** Let go of ayat: their record is removed, as though they had never been kept. */
export function letGo(indexes: number[]): void {
  const next = new Map(store.getSnapshot());
  let changed = false;
  for (const i of indexes) changed = next.delete(i) || changed;
  if (changed) store.set(writable(next));
}

export function useHifz(): Hifz {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** The record as it stands, outside React — a sitting reads it once as it opens. */
export function currentHifz(): Hifz {
  return store.getSnapshot();
}

// ── reading the record ──────────────────────────────────────────────────────

/** The ayat due on or before a day, in the order of the muṣḥaf. */
export function dueOn(hifz: Hifz, today = dayKey()): number[] {
  const out: number[] = [];
  for (const [index, k] of hifz) if (k.due <= today) out.push(index);
  return out.sort((a, b) => a - b);
}

/** The first day after today on which something is due, or null when nothing waits. */
export function nextDue(hifz: Hifz, today = dayKey()): string | null {
  let first: string | null = null;
  for (const k of hifz.values()) if (k.due > today && (!first || k.due < first)) first = k.due;
  return first;
}

export interface SurahKept {
  surah: number;
  /** The ayat of it kept, in order, each with its record. */
  ayat: { ayah: number; index: number; kept: Kept }[];
  due: number;
}

/** What is kept, surah by surah, in the order of the muṣḥaf. */
export function bySurah(hifz: Hifz, today = dayKey()): SurahKept[] {
  const rows = new Map<number, SurahKept>();
  for (const index of [...hifz.keys()].sort((a, b) => a - b)) {
    const kept = hifz.get(index) as Kept;
    const [surah, ayah] = ayahKey(index).split(":").map(Number);
    const row = rows.get(surah) ?? { surah, ayat: [], due: 0 };
    row.ayat.push({ ayah, index, kept });
    if (kept.due <= today) row.due += 1;
    rows.set(surah, row);
  }
  return [...rows.values()];
}

/** Which of four depths of light an ayah of this strength is drawn in, from 1. */
export function depth(strength: number): 1 | 2 | 3 | 4 {
  return strength >= 6 ? 4 : strength >= 4 ? 3 : strength >= 2 ? 2 : 1;
}
