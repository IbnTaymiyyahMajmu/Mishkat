"use client";

import { useMemo } from "react";
import { SURAH_NAMES } from "../quran/surahNames";
import { useChapters } from "../store/chapters";
import { isolate, useLocale } from "./index";

export interface SurahNames {
  /** What a surah is called on this reader's screen. */
  name: (id: number) => string;
  /**
   * What the name means: "The Sovereignty". Given only beside a name in Latin
   * letters — beside the Arabic it would be the one English phrase on a page
   * that has no other, so there it is empty.
   */
  meaning: (id: number) => string;
  /**
   * Whether the name above is the Arabic one. A screen that prints the Arabic
   * name beside the Latin one then has it once, not twice, and sets it in an
   * Arabic face (`.surah-ar`, in globals.css).
   */
  arabic: boolean;
}

/**
 * The names of the surahs, as this reader reads them.
 *
 * In English a surah is "Al-Mulk", with what that means under it. In every
 * other language it is الملك and nothing else. The reasoning is the reader's
 * and not the site's: "Ta Ha" and "Al-Mulk" are English spellings, and say
 * nothing to someone who reads Pashto or Persian and not English — but they
 * read the Arabic, as it is written at the head of the surah in every muṣḥaf.
 * So the rest of the page is in their language and the names are in Arabic.
 *
 * The live chapter table is used once it has landed, and the table baked into
 * the build until then, so a name is never a blank waiting on the network.
 */
export function useSurahNames(): SurahNames {
  const { byId } = useChapters();
  const { arabicNames, rtl, t } = useLocale();

  return useMemo(
    () => ({
      arabic: arabicNames,
      name: (id) => {
        const live = byId(id);
        const baked = SURAH_NAMES[id - 1];
        if (!arabicNames) return live?.name_simple ?? baked?.english ?? t("common.surahN", { n: id });
        const arabic = live?.name_arabic ?? baked?.arabic;
        // On a page read left to right the name is a stretch of the other
        // direction, and is nearly always followed by a number. See `isolate`.
        return arabic ? isolate(arabic, rtl) : t("common.surahN", { n: id });
      },
      meaning: (id) =>
        arabicNames ? "" : (byId(id)?.translated_name?.name ?? SURAH_NAMES[id - 1]?.meaning ?? ""),
    }),
    [byId, arabicNames, rtl, t],
  );
}
