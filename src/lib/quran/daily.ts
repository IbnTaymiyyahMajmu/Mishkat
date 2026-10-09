import type { MessageKey } from "../i18n/types";

/**
 * The ayah the landing page opens with.
 *
 * The choice is made by the date, not at random and not by the reader: the page
 * turns over once a day and shows everyone the same ayah, so it reads as a
 * calendar rather than a shuffle. Each entry carries the state of mind it
 * answers, which is what the page prints beside it — the ayah is offered for
 * something, not merely displayed.
 */
export interface DailyEntry {
  key: string;
  /** Said in the reader's language: see "daily.*" in lib/i18n/messages. */
  theme: MessageKey;
}

export const DAILY: DailyEntry[] = [
  { key: "2:286", theme: "daily.2:286" },
  { key: "13:28", theme: "daily.13:28" },
  { key: "94:5", theme: "daily.94:5" },
  { key: "65:3", theme: "daily.65:3" },
  { key: "39:53", theme: "daily.39:53" },
  { key: "3:139", theme: "daily.3:139" },
  { key: "20:114", theme: "daily.20:114" },
  { key: "29:69", theme: "daily.29:69" },
  { key: "17:82", theme: "daily.17:82" },
  { key: "2:255", theme: "daily.2:255" },
  { key: "55:13", theme: "daily.55:13" },
  { key: "18:10", theme: "daily.18:10" },
];

const DAY_MS = 86_400_000;

/**
 * Which of the twelve today is. Read the clock only in the browser: the site is
 * prerendered at build time, and baking the build day's ayah into the HTML would
 * hand every later visitor a stale one.
 */
export function dailyIndexForToday(now: number = Date.now()): number {
  return Math.floor(now / DAY_MS) % DAILY.length;
}
