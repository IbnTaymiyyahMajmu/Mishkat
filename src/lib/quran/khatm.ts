import structure from "@/content/structure.json";
import ayahWords from "@/content/ayah-words.json";

/**
 * Cutting the Qurʾān into days.
 *
 * A plan to finish it in so many days is that many portions, and the
 * arithmetic of it is easy: the words left, divided by the days left. What is
 * not easy is where a portion ends. The arithmetic ends it wherever the count
 * runs out, which is usually the middle of a passage, and a reader who stops
 * there has not finished anything. The muṣḥaf has its own places to stop — the
 * juzʾ, the ḥizb and its quarters, the rukūʿ, the page, the end of a surah —
 * and a portion should end at one of them.
 *
 * So the days are chosen together, not one at a time. Every place a portion
 * could end is a candidate, and the plan is the set of ends that keeps the
 * days as even as possible while preferring the larger divisions: a month
 * read from al-Fātiḥah comes out as the thirty juzʾ, and a week as seven
 * portions that each close at a ḥizb or a surah. Words are what is weighed —
 * the nearest thing in the text to the time it takes to read.
 */

/** How many words each ayah has, by its place among all 6,236 (from 1). */
const WORDS: number[] = [0, ...(ayahWords as number[][]).flat()];

/** Words before each ayah: words of the run from..to are PREFIX[to] - PREFIX[from - 1]. */
const PREFIX: number[] = WORDS.reduce<number[]>((acc, w, i) => (acc.push((acc[i - 1] ?? 0) + w), acc), []);

export const TOTAL_WORDS = PREFIX[6236];

export function wordsIn(from: number, to: number): number {
  return PREFIX[to] - PREFIX[from - 1];
}

type Division = "juz" | "hizb" | "rub" | "surah" | "ruku" | "page" | "ayah";

/**
 * What it costs to stop at each kind of place, beside the cost of an uneven
 * day. Small, so evenness still decides; enough that, of two ends nearly as
 * even, the juzʾ is taken over the page.
 */
const STOP: Record<Division, number> = {
  juz: 0,
  hizb: 0.004,
  surah: 0.006,
  rub: 0.012,
  ruku: 0.03,
  page: 0.05,
  ayah: 0.2,
};

/** For each ayah, the best kind of place its end is: 6,236 is the end of everything. */
const END: (Division | null)[] = (() => {
  const out: (Division | null)[] = new Array(6237).fill(null);
  const mark = (kind: Division, starts: number[]) => {
    for (const start of starts) {
      const end = start - 1;
      if (end < 1) continue;
      if (!out[end] || STOP[kind] < STOP[out[end] as Division]) out[end] = kind;
    }
  };
  const s = structure;
  mark("page", s.page);
  mark("ruku", s.ruku);
  mark("rub", s.rub);
  mark("surah", s.surah);
  mark("hizb", s.hizb);
  mark("juz", s.juz);
  out[6236] = "juz";
  return out;
})();

export interface Portion {
  /** Which day of the plan, from 0. */
  day: number;
  /** The ayat it runs over, by their place among all 6,236, both inclusive. */
  from: number;
  to: number;
  words: number;
  /** What its end is: "juz" when it closes a juzʾ, and so on. */
  closes: Division;
}

/**
 * The days of a plan: `days` portions from ayah `from` to ayah `to`.
 *
 * Dynamic programming over the places a portion may end. The cost of a day is
 * how far its words fall from the even share, squared and taken as a fraction
 * of it, plus what it costs to stop where it stops; the plan is the cheapest
 * way through. Only ends within a sensible reach of the even share are tried,
 * so a year's plan is as quick to make as a week's.
 */
export function planPortions(from: number, to: number, days: number): Portion[] {
  from = Math.max(1, Math.min(6236, Math.round(from)));
  to = Math.max(from, Math.min(6236, Math.round(to)));
  days = Math.max(1, Math.round(days));
  const ayat = to - from + 1;
  if (days >= ayat) {
    // More days than ayat: an ayah a day, and the rest are rest.
    return Array.from({ length: ayat }, (_, d) => ({
      day: d,
      from: from + d,
      to: from + d,
      words: WORDS[from + d],
      closes: END[from + d] ?? "ayah",
    }));
  }

  // A reading that begins at a juzʾ and whose days share the juzʾ out evenly
  // is the juzʾ, and nothing cleverer: a juzʾ a day for a month, two for
  // fifteen days, ten for three. It is how the muṣḥaf is divided for exactly
  // this, and what a reader doing it expects to be told to read.
  const juzStarts = structure.juz;
  const atJuz = juzStarts.indexOf(from);
  if (atJuz >= 0 && to === 6236) {
    const left = 30 - atJuz;
    if (left % days === 0) {
      const each = left / days;
      return Array.from({ length: days }, (_, d) => {
        const a = juzStarts[atJuz + d * each];
        const b = atJuz + (d + 1) * each < 30 ? juzStarts[atJuz + (d + 1) * each] - 1 : 6236;
        return { day: d, from: a, to: b, words: wordsIn(a, b), closes: "juz" as Division };
      });
    }
  }

  const target = wordsIn(from, to) / days;
  // The places a day may end, in order; `to` always among them. The muṣḥaf's
  // own divisions are enough unless there are more days than divisions to
  // end them at, when any ayah will do.
  const ends: number[] = [];
  let divisions = 0;
  for (let i = from; i < to; i++) if (END[i]) divisions++;
  const fine = divisions < days * 2;
  for (let i = from; i < to; i++) if (END[i] || fine) ends.push(i);
  ends.push(to);

  for (const [lo, hi] of [
    [0.45, 1.8],
    [0.2, 3],
    [0, Infinity],
  ]) {
    const plan = solve(from, ends, days, target, lo, hi);
    if (plan) return plan;
  }
  // Unreachable in practice: the last pass allows any split.
  return [{ day: 0, from, to, words: wordsIn(from, to), closes: END[to] ?? "ayah" }];
}

function solve(from: number, ends: number[], days: number, target: number, lo: number, hi: number): Portion[] | null {
  const n = ends.length;
  const last = n - 1;
  // cost[k][j]: the best way to end day k (from 1) at ends[j].
  const cost: Float64Array[] = [];
  const back: Int32Array[] = [];
  const prefixAt = (j: number) => PREFIX[ends[j]];
  const base = PREFIX[from - 1];

  const dayCost = (words: number, end: number) => {
    const off = (words - target) / target;
    return off * off + STOP[END[end] ?? "ayah"];
  };

  // Day 1: from the start to each end within reach.
  cost[0] = new Float64Array(n).fill(Infinity);
  back[0] = new Int32Array(n).fill(-1);
  for (let j = 0; j < n; j++) {
    const words = prefixAt(j) - base;
    if (words > hi * target) break;
    if (words >= lo * target || (days === 1 && j === last)) cost[0][j] = dayCost(words, ends[j]);
  }

  for (let k = 1; k < days; k++) {
    const prev = cost[k - 1];
    const here = new Float64Array(n).fill(Infinity);
    const from_ = new Int32Array(n).fill(-1);
    // Each day leaves enough ends for the days after it.
    const remaining = days - 1 - k;
    let i0 = 0;
    for (let j = k; j < n - remaining; j++) {
      const top = prefixAt(j) - hi * target;
      while (i0 < j && prefixAt(i0) < top) i0++;
      let best = Infinity;
      let arg = -1;
      for (let i = i0; i < j; i++) {
        if (prev[i] === Infinity) continue;
        const words = prefixAt(j) - prefixAt(i);
        if (words < lo * target) break;
        const c = prev[i] + dayCost(words, ends[j]);
        if (c < best) {
          best = c;
          arg = i;
        }
      }
      here[j] = best;
      from_[j] = arg;
    }
    cost[k] = here;
    back[k] = from_;
  }

  if (cost[days - 1][last] === Infinity) return null;

  const cuts: number[] = [];
  let j = last;
  for (let k = days - 1; k >= 0; k--) {
    cuts.push(j);
    j = back[k][j];
  }
  cuts.reverse();

  const out: Portion[] = [];
  let start = from;
  cuts.forEach((c, day) => {
    const end = ends[c];
    out.push({ day, from: start, to: end, words: wordsIn(start, end), closes: END[end] ?? "ayah" });
    start = end + 1;
  });
  return out;
}

/** The page of the Madīnah muṣḥaf an ayah begins on, from 0. */
function pageOf(index: number): number {
  const starts = structure.page;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The ayat on a page, by its place from 0. */
function pageRun(page: number): [number, number] {
  const starts = structure.page;
  return [starts[page], page + 1 < starts.length ? starts[page + 1] - 1 : 6236];
}

/**
 * How many pages of the Madīnah muṣḥaf a run of ayat covers, to the half page:
 * the whole pages it spans, and of a page it begins or ends partway down, the
 * share of that page's words it takes. A juzʾ is the twenty pages it is in
 * print, not an average.
 */
export function pagesIn(from: number, to: number): number {
  const a = pageOf(from);
  const b = pageOf(to);
  const share = (page: number, x: number, y: number) => {
    const [s, e] = pageRun(page);
    return wordsIn(Math.max(s, x), Math.min(e, y)) / wordsIn(s, e);
  };
  const pages = a === b ? share(a, from, to) : share(a, from, to) + (b - a - 1) + share(b, from, to);
  return Math.max(0.5, Math.round(pages * 2) / 2);
}

/** Minutes to recite a run of ayat at an unhurried pace. */
export function minutesFor(words: number): number {
  return Math.max(1, Math.round(words / 60));
}

/** The juzʾ an ayah falls in, from 1. */
export function juzOf(index: number): number {
  const starts = structure.juz;
  let j = 0;
  while (j + 1 < starts.length && starts[j + 1] <= index) j++;
  return j + 1;
}
