import { SURAH_NAMES } from "./surahNames";
import type { Chapter } from "./types";

/**
 * The thirty juz, as the first and last ayah of each.
 *
 * These are boundaries of the printed muṣḥaf, fixed for centuries and identical
 * in every edition, so they are a constant here rather than something asked of
 * the corpus. A juz can begin mid-surah — the fourth opens at 3:93 — which is
 * why both ends are stored as verse keys and not as surah numbers.
 */
const JUZ_START = [
  "1:1", "2:142", "2:253", "3:93", "4:24", "4:148", "5:82", "6:111", "7:88", "8:41",
  "9:93", "11:6", "12:53", "15:1", "17:1", "18:75", "21:1", "23:1", "25:21", "27:56",
  "29:46", "33:31", "36:28", "39:32", "41:47", "46:1", "51:31", "58:1", "67:1", "78:1",
];

const JUZ_END = [
  "2:141", "2:252", "3:92", "4:23", "4:147", "5:81", "6:110", "7:87", "8:40", "9:92",
  "11:5", "12:52", "14:52", "16:128", "18:74", "20:135", "22:78", "25:20", "27:55", "29:45",
  "33:30", "36:27", "39:31", "41:46", "45:37", "51:30", "57:29", "66:12", "77:50", "114:6",
];

export interface JuzRow {
  n: number;
  /** Where it opens, as a verse key — what a link to the juz points at. */
  startKey: string;
  startSurah: number;
  /** "Al-Baqarah 142 → Al-Baqarah 252" */
  range: string;
  sub: string;
  arabic: string;
}

/**
 * The thirty rows, named. `byId` is the live chapter table when it has landed;
 * the baked-in names stand in until it does, so the list is never thirty blanks
 * waiting on a network call.
 */
export function juzRows(byId: (id: number) => Chapter | undefined): JuzRow[] {
  const name = (n: number) => byId(n)?.name_simple ?? SURAH_NAMES[n - 1]?.english ?? `Surah ${n}`;
  const arabic = (n: number) => byId(n)?.name_arabic ?? SURAH_NAMES[n - 1]?.arabic ?? "";

  return JUZ_START.map((start, i) => {
    const end = JUZ_END[i];
    const [startSurah, startAyah] = start.split(":");
    const [endSurah, endAyah] = end.split(":");
    const from = +startSurah;
    const to = +endSurah;
    return {
      n: i + 1,
      startKey: start,
      startSurah: from,
      range: `${name(from)} ${startAyah} → ${name(to)} ${endAyah}`,
      sub:
        from === to
          ? `Within ${name(from)}`
          : `${to - from + 1} surahs · ${name(from)} to ${name(to)}`,
      arabic: arabic(from),
    };
  });
}
