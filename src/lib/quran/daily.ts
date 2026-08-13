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
  theme: string;
}

export const DAILY: DailyEntry[] = [
  { key: "2:286", theme: "When it feels like too much" },
  { key: "13:28", theme: "A restless heart" },
  { key: "94:5", theme: "In the middle of hardship" },
  { key: "65:3", theme: "Worry about provision" },
  { key: "39:53", theme: "Feeling past forgiving" },
  { key: "3:139", theme: "Discouragement" },
  { key: "20:114", theme: "Before study" },
  { key: "29:69", theme: "Trying to keep on" },
  { key: "17:82", theme: "Healing" },
  { key: "2:255", theme: "The Throne Verse" },
  { key: "55:13", theme: "Gratitude" },
  { key: "18:10", theme: "Asking for guidance" },
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
