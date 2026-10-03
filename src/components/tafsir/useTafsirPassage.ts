"use client";

import { useCallback, useEffect, useState } from "react";
import type { TafsirPassage, TafsirWork } from "@/lib/quran/tafsir";

export type PassageState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; passage: TafsirPassage };

/**
 * One work's passage on one ayah.
 *
 * The answer is stamped with the question — which work, which ayah, which
 * attempt — and anything stamped otherwise reads as still loading. So moving
 * to the next ayah, or to another work, never shows the last passage under the
 * new heading for even a frame, and nothing has to be cleared to make it so.
 *
 * Every source behind a work keeps what it has fetched, so asking again for a
 * passage already read costs nothing; that is what makes it safe to simply ask
 * whenever the question changes.
 */
export function useTafsirPassage(
  work: TafsirWork | undefined,
  verseKey: string,
): PassageState & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<{ stamp: string; state: PassageState } | null>(null);

  const stamp = `${work?.id ?? ""}|${verseKey}|${attempt}`;

  useEffect(() => {
    if (!work || !verseKey) return;
    let alive = true;
    work
      .load(verseKey)
      .then((passage) => alive && setAnswer({ stamp, state: { status: "ready", passage } }))
      .catch(() => alive && setAnswer({ stamp, state: { status: "failed" } }));
    return () => {
      alive = false;
    };
  }, [work, verseKey, stamp]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state: PassageState = answer?.stamp === stamp ? answer.state : { status: "loading" };
  return { ...state, retry };
}
