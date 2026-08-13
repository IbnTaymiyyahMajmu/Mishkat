"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { fetchVerse } from "@/lib/quran/api";
import { dailyIndexForToday } from "@/lib/quran/daily";
import { DEFAULT_TRANSLATION } from "@/lib/quran/resources";
import { useSettings } from "@/lib/store/settings";
import { plainText } from "@/lib/text";

/** The clock is not a store that changes under us within a visit. */
const noSubscription = () => () => {};

/**
 * Which of the twelve ayat today is, or `null` before the browser has had its
 * say.
 *
 * The site is exported as static files, so a date read while prerendering would
 * bake the build day's ayah into the HTML and hand it to every later visitor.
 * The calendar is treated as what it is here — something outside React that the
 * server cannot see — so the prerendered page shows the page turning and the
 * browser names the day.
 */
export function useDailyIndex(): number | null {
  return useSyncExternalStore(noSubscription, dailyIndexForToday, () => null);
}

export interface DailyAyah {
  key: string;
  arabic: string;
  translation: string;
  translator: string;
}

interface Answer {
  key: string;
  translationId: number;
  ayah: DailyAyah;
}

/**
 * The day's ayah, in the reader's chosen translation.
 *
 * The answer is stamped with the request it belongs to, so a translation
 * changed mid-flight never leaves the previous translator's name printed under
 * the new text. Not every translation is served by the by-key endpoint; when
 * the chosen one comes back empty the default is fetched rather than showing a
 * blank line under the Arabic.
 */
export function useDailyAyah(key: string | null): DailyAyah | null {
  const { settings } = useSettings();
  const translationId = settings.translationId;
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;

    (async () => {
      let verse = await fetchVerse(key, translationId);
      let translation = verse?.translations?.[0];
      if (!translation?.text && translationId !== DEFAULT_TRANSLATION) {
        verse = await fetchVerse(key, DEFAULT_TRANSLATION);
        translation = verse?.translations?.[0];
      }
      if (!alive) return;

      setAnswer({
        key,
        translationId,
        ayah: verse
          ? {
              key,
              arabic: verse.text_uthmani ?? "",
              translation: plainText(translation?.text),
              translator: translation?.resource_name ?? "",
            }
          : {
              key,
              arabic: "",
              translation: "This ayah could not be reached just now.",
              translator: "",
            },
      });
    })();

    return () => {
      alive = false;
    };
  }, [key, translationId]);

  if (!answer || answer.key !== key || answer.translationId !== translationId) return null;
  return answer.ayah;
}
