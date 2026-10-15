"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createPersistedStore } from "./persisted";
import { addDays, dayKey, daysBetween, parse, runs, type ReadingLog } from "./reading";
import structure from "@/content/structure.json";
import { TOTAL_WORDS, planPortions, wordsIn, type Portion } from "../quran/khatm";

/**
 * The reader's plan to finish the Qurʾān: how many days a reading of it takes,
 * where this reading began, and how many have been finished before it.
 *
 * Only the choices are kept. The portions are worked out again from them
 * whenever they are wanted (`planPortions`), so a plan written by one version
 * of the site is read by the next without migrating anything.
 */

/** The steps of the hadith of ʿAbdullāh ibn ʿAmr, a pace of the reader's own, or a day to finish by. */
export type Goal = "month" | "twenty" | "ten" | "week" | "three" | "custom" | "date";

export const GOALS: Goal[] = ["month", "twenty", "ten", "week", "three", "custom", "date"];

export interface Cycle {
  /** The day this reading began on, and the ayah it began at (from 1). */
  start: string;
  from: number;
  /** How many days it is meant to take, counted from `start`. */
  days: number;
  /** Which reading this is: the first, the second… */
  number: number;
  /**
   * The day the reading was first begun, when the days left of it have since
   * been spread again (`rebalance`): `start` and `from` are then where the
   * respread began, and this is where the reading did.
   */
  began?: string;
  /**
   * Ayat already read on the first day before this reading began, which are
   * the last reading's and not this one's: a reading begun again the day the
   * last was finished does not start out finished.
   */
  ignore?: string;
}

export interface Plan {
  v: 1;
  goal: Goal;
  /** The days a whole reading takes when it is begun again. */
  every: number;
  /** Whether a finished reading is followed by another. */
  repeat: boolean;
  cycle: Cycle;
  /** Readings finished: on which day, and in how many days. */
  done: { day: string; days: number }[];
  /** The day a plan that does not repeat was finished, after which it waits to be begun again. */
  closed?: string;
}

/** No reading shorter than three days: see the plan page for why. */
export const SHORTEST = 3;
export const LONGEST = 400;

function revive(stored: unknown): Plan | null {
  if (!stored || typeof stored !== "object") return null;
  const p = stored as Partial<Plan>;
  const c = p.cycle as Partial<Cycle> | undefined;
  if (!c || typeof c.start !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(c.start)) return null;
  const from = Number(c.from);
  const days = Number(c.days);
  if (!(from >= 1 && from <= 6236) || !(days >= 1 && days <= LONGEST)) return null;
  const every = Math.min(LONGEST, Math.max(SHORTEST, Number(p.every) || days));
  return {
    v: 1,
    goal: GOALS.includes(p.goal as Goal) ? (p.goal as Goal) : "custom",
    every,
    repeat: p.repeat !== false,
    cycle: {
      start: c.start,
      from: Math.round(from),
      days: Math.round(days),
      number: Math.max(1, Number(c.number) || 1),
      began: typeof c.began === "string" && c.began <= c.start ? c.began : undefined,
      ignore: typeof c.ignore === "string" && /^[\d,-]*$/.test(c.ignore) ? c.ignore : undefined,
    },
    done: Array.isArray(p.done)
      ? p.done.filter((d) => d && typeof d.day === "string" && Number.isFinite(d.days)).slice(-200)
      : [],
    closed: typeof p.closed === "string" ? p.closed : undefined,
  };
}

const store = createPersistedStore<Plan | null>("mishkat.plan.v1", null, revive);

export function usePlan() {
  const plan = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const set = useCallback((next: Plan | null) => store.set(next), []);
  return { plan, set };
}

/** The plan as it stands, outside React — for the watcher that says when a day is done. */
export function currentPlan(): Plan | null {
  return store.getSnapshot();
}

export function setPlan(next: Plan | null) {
  store.set(next);
}

// ── where the reader stands ─────────────────────────────────────────────────

const portionsCache = new Map<string, Portion[]>();

/** The portions of the current reading, cached: making a year's plan is not free. */
export function portionsOf(cycle: Cycle): Portion[] {
  const key = `${cycle.from}:${cycle.days}`;
  let p = portionsCache.get(key);
  if (!p) {
    p = planPortions(cycle.from, 6236, cycle.days);
    portionsCache.set(key, p);
    if (portionsCache.size > 12) portionsCache.delete(portionsCache.keys().next().value as string);
  }
  return p;
}

/** A portion is read when nearly all its words are: an ayah or two that scrolled past unread does not hold a day open. */
export const ENOUGH = 0.92;

export interface Standing {
  portions: Portion[];
  /** Which day of the reading today is, from 0; may run past the last. */
  today: number;
  /** For each portion, how much of it has been read, 0 to 1. */
  read: number[];
  /** Every ayah of the reading read since it began. */
  readSet: Set<number>;
  /** How many portions are read. */
  finished: number;
  /** The first portion not yet read: where the reader should be. `portions.length` when all are. */
  current: number;
  /** The first ayah of the reading not yet read, or 0 when there is none. */
  next: number;
  /**
   * Days ahead (above 0) or behind (below 0). Behind is a day before today
   * left unread; today's portion waiting to be read is not behind.
   */
  lead: number;
  /** The whole reading is read. */
  complete: boolean;
}

export function standing(plan: Plan, log: ReadingLog, now = dayKey()): Standing {
  const { cycle } = plan;
  const portions = portionsOf(cycle);
  const ignored = cycle.ignore ? parse(cycle.ignore) : null;
  const readSet = new Set<number>();
  for (const [day, set] of log.days) {
    if (day < cycle.start) continue;
    for (const i of set) if (!(ignored && day === cycle.start && ignored.has(i))) readSet.add(i);
  }
  const read = portions.map((p) => {
    let words = 0;
    for (let i = p.from; i <= p.to; i++) if (readSet.has(i)) words += wordsIn(i, i);
    return p.words ? words / p.words : 1;
  });
  const finished = read.filter((r) => r >= ENOUGH).length;
  let next = 0;
  for (let i = cycle.from; i <= 6236; i++) {
    if (!readSet.has(i)) {
      next = i;
      break;
    }
  }
  const current = read.findIndex((r) => r < ENOUGH);
  const today = daysBetween(cycle.start, now);
  const complete = finished === portions.length || next === 0;
  const lead =
    finished > today + 1 ? finished - (today + 1) : finished < today ? finished - Math.min(today, portions.length) : 0;
  return {
    portions,
    today,
    read,
    readSet,
    finished,
    current: current < 0 ? portions.length : current,
    next,
    lead,
    complete,
  };
}

/**
 * How many days the reading from `from` takes at the pace of a whole reading
 * every `every` days. Begun at a juzʾ it is so many juzʾ at the pace's own
 * rate — sixteen juzʾ left at a juzʾ a day is sixteen days — and anywhere
 * else it is the share of the words left.
 */
export function daysFrom(every: number, from: number): number {
  if (from <= 1) return every;
  const atJuz = structure.juz.indexOf(from);
  const share = atJuz >= 0 ? (30 - atJuz) / 30 : wordsIn(from, 6236) / TOTAL_WORDS;
  return Math.max(1, Math.round(every * share));
}

/** The pace a reading of `days` days from `from` keeps, as the days a whole reading would take at it. */
export function paceOf(days: number, from: number): number {
  return (days * TOTAL_WORDS) / wordsIn(from, 6236);
}

/** A new plan: a reading from `from`, of `days` days, beginning today. */
export function newPlan(goal: Goal, every: number, from: number, days: number, repeat: boolean, previous?: Plan | null): Plan {
  return {
    v: 1,
    goal,
    every: Math.max(SHORTEST, Math.round(every)),
    repeat,
    cycle: { start: dayKey(), from, days: Math.max(1, Math.round(days)), number: (previous?.done.length ?? 0) + 1 },
    done: previous?.done ?? [],
  };
}

/**
 * Spread what is left of the reading over the days left of it: the end date is
 * kept, and today's portion becomes everything from the first unread ayah
 * divided by the days remaining.
 */
export function rebalance(plan: Plan, from: number, now = dayKey()): Plan {
  const end = addDays(plan.cycle.start, plan.cycle.days);
  const left = Math.max(1, daysBetween(now, end));
  return {
    ...plan,
    cycle: { ...plan.cycle, began: plan.cycle.began ?? plan.cycle.start, start: now, from, days: left, ignore: now === plan.cycle.start ? plan.cycle.ignore : undefined },
  };
}

/** How many days of the reading went by before its days were last spread again: the first portion now is day this + 1. */
export function dayOffset(plan: Plan): number {
  return plan.cycle.began ? daysBetween(plan.cycle.began, plan.cycle.start) : 0;
}

/**
 * The next reading was to begin tomorrow, and the reader would rather begin it
 * now. What they read today was the last reading's, and is set aside.
 */
export function beginNow(plan: Plan, log: ReadingLog, now = dayKey()): Plan {
  const today = log.days.get(now);
  return {
    ...plan,
    cycle: { ...plan.cycle, start: now, began: undefined, ignore: today?.size ? runs(today) : undefined },
  };
}

/** The reading is finished: it is counted, and the next begins tomorrow — if the reader asked for one. */
export function finishCycle(plan: Plan, now = dayKey()): Plan {
  const took = Math.max(1, daysBetween(plan.cycle.began ?? plan.cycle.start, now) + 1);
  const done = [...plan.done, { day: now, days: took }];
  if (!plan.repeat) return { ...plan, done, closed: now };
  return { ...plan, done, cycle: { start: addDays(now, 1), from: 1, days: plan.every, number: done.length + 1 } };
}
