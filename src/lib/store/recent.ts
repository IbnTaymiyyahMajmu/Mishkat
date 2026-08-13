"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createPersistedStore } from "./persisted";

/** How many past searches the overlay offers back. */
const KEEP = 7;

const NONE: string[] = [];

const store = createPersistedStore<string[]>("mishkat.recent.v1", NONE, (stored) =>
  Array.isArray(stored) ? stored.filter((x): x is string => typeof x === "string").slice(0, KEEP) : NONE,
);

export interface RecentSearches {
  recent: string[];
  /** Records a query, most recent first and without duplicates. */
  remember: (query: string) => void;
  clear: () => void;
}

export function useRecentSearches(): RecentSearches {
  const recent = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const remember = useCallback((query: string) => {
    const q = query.trim();
    if (q.length < 2) return;
    const current = store.getSnapshot();
    // Re-searching something already at the top must not rewrite storage, or
    // every keystroke that settles on the same term notifies every subscriber.
    if (current[0] === q) return;
    store.set([q, ...current.filter((x) => x !== q)].slice(0, KEEP));
  }, []);

  const clear = useCallback(() => store.set(NONE), []);

  return { recent, remember, clear };
}
