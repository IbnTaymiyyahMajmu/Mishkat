"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

export const SCROLL_TO_VERSE = "mishkat:scroll-to-verse";

export interface ScrollToVerseDetail {
  key: string;
  flash?: boolean;
}

/**
 * Move to an ayah from anywhere: search results, bookmarks, notes, the word
 * study panel. If the reader is already in that surah it is a scroll, not a
 * navigation, so the surah is never re-fetched and the place is never lost.
 */
export function useGoToVerse(): (verseKey: string) => void {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (verseKey: string) => {
      const surah = Number(verseKey.split(":")[0]);
      if (!Number.isFinite(surah) || surah < 1 || surah > 114) return;
      const target = `/read/${surah}/`;

      if (pathname === target) {
        window.history.replaceState(null, "", `#${verseKey}`);
        window.dispatchEvent(
          new CustomEvent<ScrollToVerseDetail>(SCROLL_TO_VERSE, {
            detail: { key: verseKey, flash: true },
          }),
        );
        return;
      }
      router.push(`${target}#${verseKey}`);
    },
    [pathname, router],
  );
}
