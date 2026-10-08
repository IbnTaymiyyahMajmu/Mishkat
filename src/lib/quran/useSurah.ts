"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchVersePage } from "./api";
import type { MessageKey } from "../i18n/types";
import type { Verse } from "./types";

export interface SurahState {
  verses: Verse[];
  /** True until the first page of ayat is on screen. */
  loading: boolean;
  /** True while the remaining pages of a long surah are still arriving. */
  loadingMore: boolean;
  /** What went wrong, as a sentence the screen says in the reader's language. */
  error: MessageKey | null;
  reload: () => void;
}

type Status = "loading" | "streaming" | "ready" | "failed";

interface Snapshot {
  /** Which request this data belongs to. Anything else on screen is stale. */
  request: string;
  verses: Verse[];
  status: Status;
}

const EMPTY: Snapshot = { request: "", verses: [], status: "loading" };
/** One shared empty list, so "nothing yet" is the same reference on every
 *  render and nothing downstream mistakes it for new data. */
const NO_VERSES: Verse[] = [];

/**
 * Loads a surah in pages: the first fifty ayat land as fast as the network
 * allows, then the rest stream in behind them. Al-Baqarah is 286 ayat and about
 * 1.6 MB of word data — waiting for all of it before showing anything would
 * cost several seconds of blank page for a reader who wanted ayah 1.
 *
 * All of the state is one object stamped with the request it came from, so
 * switching surah or reciter shows nothing from the previous one for even a
 * frame, and no state has to be cleared before the new fetch begins.
 *
 * The translations are not part of it. They are laid over this text by
 * `useSurahTranslations`, so that choosing another leaves the Arabic standing.
 */
export function useSurah(surah: number, reciterId: number, glossLanguage: string): SurahState {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [nonce, setNonce] = useState(0);

  const request = `${surah}:${reciterId}:${glossLanguage}:${nonce}`;
  const fresh = snapshot.request === request;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const first = await fetchVersePage(surah, { reciterId, glossLanguage, page: 1 });
        if (!alive) return;
        setSnapshot({
          request,
          verses: first.verses,
          status: first.totalPages > 1 ? "streaming" : "ready",
        });

        for (let page = 2; page <= first.totalPages; page++) {
          const next = await fetchVersePage(surah, { reciterId, glossLanguage, page });
          if (!alive) return;
          setSnapshot((prev) =>
            prev.request === request
              ? {
                  ...prev,
                  verses: [...prev.verses, ...next.verses],
                  status: page === first.totalPages ? "ready" : "streaming",
                }
              : prev,
          );
        }
      } catch {
        if (!alive) return;
        setSnapshot({ request, verses: [], status: "failed" });
      }
    })();

    return () => {
      alive = false;
    };
  }, [request, surah, reciterId, glossLanguage]);

  return {
    verses: fresh ? snapshot.verses : NO_VERSES,
    loading: !fresh || snapshot.status === "loading",
    loadingMore: fresh && snapshot.status === "streaming",
    error: fresh && snapshot.status === "failed" ? "reader.error" : null,
    reload,
  };
}
