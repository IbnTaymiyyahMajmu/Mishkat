"use client";

import { useMemo } from "react";
import structure from "@/content/structure.json";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { juzOf, type Portion } from "@/lib/quran/khatm";
import { ayahKey } from "@/lib/store/reading";

/**
 * How the plan's places and days are said: "Al-Baqarah 142 – Āl ʿImrān 92",
 * "Wed 14 Oct", "ends juzʾ 2". Shared by the planner, the plan and the strip on
 * the landing page, so that a portion is named the same wherever it is shown.
 */

/** A day key as a date at noon, clear of any change of clocks. */
export function dateOf(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function parts(index: number): { surah: number; ayah: number } {
  const [surah, ayah] = ayahKey(index).split(":").map(Number);
  return { surah, ayah };
}

export interface PlanWords {
  /** "Al-Kahf 1" */
  place: (index: number) => string;
  /** "Al-Baqarah 142–252", "Al-Mulk – Al-Mursalāt", "Al-Baqarah 142 – Āl ʿImrān 92" */
  range: (from: number, to: number) => string;
  /** "Wed 14 Oct" */
  day: (key: string) => string;
  /** "Wednesday 14 October" */
  longDay: (key: string) => string;
  /** "ends juzʾ 2", or "" for a portion that ends at an ayah and nothing more. */
  closes: (portion: Portion) => string;
  /** Where the reader is sent to read from an ayah. */
  href: (index: number) => string;
}

export function usePlanWords(): PlanWords {
  const { t, info } = useLocale();
  const names = useSurahNames();

  return useMemo(() => {
    const short = new Intl.DateTimeFormat(info.dates, { weekday: "short", day: "numeric", month: "short" });
    const long = new Intl.DateTimeFormat(info.dates, { weekday: "long", day: "numeric", month: "long" });
    const CLOSES: Record<Portion["closes"], MessageKey | null> = {
      juz: "plan.closes.juz",
      hizb: "plan.closes.hizb",
      rub: "plan.closes.rub",
      surah: "plan.closes.surah",
      ruku: "plan.closes.ruku",
      page: "plan.closes.page",
      ayah: null,
    };

    const place = (index: number) => {
      const { surah, ayah } = parts(index);
      return `${names.name(surah)} ${ayah}`;
    };

    const range = (from: number, to: number) => {
      const a = parts(from);
      const b = parts(to);
      const wholeStart = a.ayah === 1;
      const wholeEnd = b.ayah === SURAH_NAMES[b.surah - 1].ayat;
      if (a.surah === b.surah) {
        if (wholeStart && wholeEnd) return names.name(a.surah);
        return a.ayah === b.ayah ? `${names.name(a.surah)} ${a.ayah}` : `${names.name(a.surah)} ${a.ayah}–${b.ayah}`;
      }
      // Whole surahs are named by their names alone, as a juzʾ of them is.
      const left = wholeStart ? names.name(a.surah) : place(from);
      const right = wholeEnd ? names.name(b.surah) : place(to);
      return `${left} – ${right}`;
    };

    const closes = (p: Portion) => {
      const key = CLOSES[p.closes];
      if (!key) return "";
      if (p.closes === "juz") return t(key, { n: juzOf(p.to) });
      if (p.closes === "hizb") {
        const at = structure.hizb.indexOf(p.to + 1);
        return t(key, { n: at < 0 ? 60 : at });
      }
      if (p.closes === "surah") return t(key, { surah: names.name(parts(p.to).surah) });
      return t(key);
    };

    const href = (index: number) => {
      const { surah } = parts(index);
      return `/read/${surah}/#${ayahKey(index)}`;
    };

    return {
      place,
      range,
      day: (key: string) => short.format(dateOf(key)),
      longDay: (key: string) => long.format(dateOf(key)),
      closes,
      href,
    };
  }, [t, info.dates, names]);
}
