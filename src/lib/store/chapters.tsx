"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchChapters } from "../quran/api";
import type { Chapter } from "../quran/types";

interface ChaptersContextValue {
  chapters: Chapter[];
  byId: (id: number) => Chapter | undefined;
  loading: boolean;
  failed: boolean;
}

const Ctx = createContext<ChaptersContextValue>({
  chapters: [],
  byId: () => undefined,
  loading: true,
  failed: false,
});

/**
 * The list of 114 surahs, loaded once for the whole session. Every screen needs
 * it — the header, the index, the reader title, the bookmarks list — and it is
 * small enough that fetching it per screen would be the only wasteful thing
 * about the application.
 */
export function ChaptersProvider({ children }: { children: ReactNode }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchChapters()
      .then((c) => alive && setChapters(c))
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(() => {
    const map = new Map(chapters.map((c) => [c.id, c]));
    return { chapters, byId: (id: number) => map.get(id), loading, failed };
  }, [chapters, loading, failed]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChapters(): ChaptersContextValue {
  return useContext(Ctx);
}

export function useChapter(id: number): Chapter | undefined {
  return useChapters().byId(id);
}
