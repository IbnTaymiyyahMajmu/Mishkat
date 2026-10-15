import structure from "@/content/structure.json";
import { wordsIn } from "../quran/khatm";
import { ENOUGH } from "./plan";
import { addDays, daysBetween, type ReadingLog } from "./reading";

/**
 * The reader's niche, worked out from the reading record.
 *
 * The site is named for the niche of the ayah of light (an-Nūr 24:35): a
 * niche, a lamp in it, the lamp in a glass like a pearly star, lit from a
 * blessed oil — light upon light. The reader's constancy is drawn as their
 * own niche. Every day they read, however little, lights one more tile of
 * the niche, the light spreading out from the lamp; every juzʾ they read
 * through gilds one of the thirty medallions round the lamp's glass; and when
 * all thirty shine the Qurʾān is finished, and another lamp is hung beside it.
 *
 * Nothing here is kept. It is all read off the record of what was read and
 * when (`reading.ts`), so it cannot disagree with the plan, and there is
 * nothing to lose: a tile once lit stays lit.
 */

/** For each ayah, its juzʾ from 0. */
const JUZ_OF: Uint8Array = (() => {
  const out = new Uint8Array(6237);
  let j = 0;
  for (let i = 1; i <= 6236; i++) {
    while (j + 1 < structure.juz.length && structure.juz[j + 1] <= i) j++;
    out[i] = j;
  }
  return out;
})();

/** The words in each juzʾ. */
const JUZ_WORDS: number[] = structure.juz.map((start, j) =>
  wordsIn(start, j + 1 < structure.juz.length ? structure.juz[j + 1] - 1 : 6236),
);

/** How far the niche has been lit, named. */
export type Stage = "unlit" | "spark" | "flame" | "lamp" | "niche" | "full" | "radiant";

export interface Light {
  /** Every day anything was read, oldest first. */
  days: string[];
  /** How many ayat were read on each of them. */
  perDay: Map<string, number>;
  /** Days read: the tiles lit. */
  lit: number;
  /** Days read in a row, up to today — or up to yesterday, while today is still to come. */
  run: number;
  best: number;
  /** Days since the last day anything was read; 0 when that is today, -1 when nothing ever has been. */
  since: number;
  stage: Stage;
  /** Times all thirty juzʾ were read through: the lamps hung in the niche. */
  lamps: number;
  /** How much of each juzʾ has been read since the last lamp was hung, 0 to 1. */
  juz: number[];
  /** Medallions gilded since the last lamp was hung. */
  gilded: number;
}

function stageOf(lit: number): Stage {
  if (lit <= 0) return "unlit";
  if (lit < 2) return "spark";
  if (lit < 7) return "flame";
  if (lit < 30) return "lamp";
  if (lit < 100) return "niche";
  if (lit < 300) return "full";
  return "radiant";
}

export function lightOf(log: ReadingLog, now: string): Light {
  const days = [...log.days.keys()].filter((d) => (log.days.get(d)?.size ?? 0) > 0 && d <= now).sort();
  const perDay = new Map(days.map((d) => [d, log.days.get(d)?.size ?? 0]));

  // Runs of consecutive days.
  let best = 0;
  let current = 0;
  for (let i = 0; i < days.length; i++) {
    current = i > 0 && daysBetween(days[i - 1], days[i]) === 1 ? current + 1 : 1;
    best = Math.max(best, current);
  }
  const last = days[days.length - 1];
  const since = last ? daysBetween(last, now) : -1;
  const run = since === 0 || since === 1 ? current : 0;

  // The lamps: read through the record in order, a juzʾ at a time, and every
  // time all thirty are in, hang a lamp and begin the medallions again.
  let lamps = 0;
  let round = new Set<number>();
  let words = new Array<number>(30).fill(0);
  for (const day of days) {
    for (const i of log.days.get(day) ?? []) {
      if (round.has(i)) continue;
      round.add(i);
      words[JUZ_OF[i]] += wordsIn(i, i);
    }
    if (words.every((w, j) => w / JUZ_WORDS[j] >= ENOUGH)) {
      lamps++;
      round = new Set();
      words = new Array<number>(30).fill(0);
    }
  }
  const juz = words.map((w, j) => Math.min(1, w / JUZ_WORDS[j]));

  return {
    days,
    perDay,
    lit: days.length,
    run,
    best,
    since,
    stage: stageOf(days.length),
    lamps,
    juz,
    gilded: juz.filter((r) => r >= ENOUGH).length,
  };
}

/** The last so many weeks, Monday to Sunday, for the strip of days; days after today are null. */
export function weeks(now: string, count: number): (string | null)[][] {
  const [y, m, d] = now.split("-").map(Number);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday is 0
  const firstMonday = addDays(now, -weekday - (count - 1) * 7);
  return Array.from({ length: count }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const key = addDays(firstMonday, w * 7 + i);
      return key <= now ? key : null;
    }),
  );
}
