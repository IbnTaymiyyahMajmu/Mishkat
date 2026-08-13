"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchChapterInfo, fetchVersePage } from "./api";
import type { Para, Verse } from "./types";

export interface SurahState {
  verses: Verse[];
  /** True until the first page of ayat is on screen. */
  loading: boolean;
  /** True while the remaining pages of a long surah are still arriving. */
  loadingMore: boolean;
  error: string | null;
  info: Para[];
  reload: () => void;
}

type Status = "loading" | "streaming" | "ready" | "failed";

interface Snapshot {
  /** Which request this data belongs to. Anything else on screen is stale. */
  request: string;
  verses: Verse[];
  info: Para[];
  status: Status;
}

const EMPTY: Snapshot = { request: "", verses: [], info: [], status: "loading" };

/**
 * Loads a surah in pages: the first fifty ayat land as fast as the network
 * allows, then the rest stream in behind them. Al-Baqarah is 286 ayat and about
 * 1.6 MB of word data — waiting for all of it before showing anything would
 * cost several seconds of blank page for a reader who wanted ayah 1.
 *
 * All of the state is one object stamped with the request it came from, so
 * switching surah or translation shows nothing from the previous one for even a
 * frame, and no state has to be cleared before the new fetch begins.
 */
export function useSurah(surah: number, translationId: number, reciterId: number): SurahState {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [nonce, setNonce] = useState(0);

  const request = `${surah}:${translationId}:${reciterId}:${nonce}`;
  const fresh = snapshot.request === request;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const first = await fetchVersePage(surah, { translationId, reciterId, page: 1 });
        if (!alive) return;
        setSnapshot({
          request,
          verses: first.verses,
          info: [],
          status: first.totalPages > 1 ? "streaming" : "ready",
        });

        for (let page = 2; page <= first.totalPages; page++) {
          const next = await fetchVersePage(surah, { translationId, reciterId, page });
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
        setSnapshot({ request, verses: [], info: [], status: "failed" });
      }
    })();

    // The introduction is a separate, slower call; it must not hold up the text.
    fetchChapterInfo(surah)
      .then((info) => {
        if (!alive) return;
        setSnapshot((prev) => (prev.request === request ? { ...prev, info } : prev));
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [request, surah, translationId, reciterId]);

  return {
    verses: fresh ? snapshot.verses : [],
    info: fresh ? snapshot.info : [],
    loading: !fresh || snapshot.status === "loading",
    loadingMore: fresh && snapshot.status === "streaming",
    error:
      fresh && snapshot.status === "failed"
        ? "The Qur’an text could not be reached. Check the connection and try again."
        : null,
    reload,
  };
}
