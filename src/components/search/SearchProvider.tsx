"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface SearchContextValue {
  open: boolean;
  openSearch: (seed?: string) => void;
  closeSearch: () => void;
  seed: string;
}

const Ctx = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState("");

  const openSearch = useCallback((value = "") => {
    setSeed(value);
    setOpen(true);
  }, []);
  const closeSearch = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        openSearch();
      } else if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch]);

  const value = useMemo(() => ({ open, openSearch, closeSearch, seed }), [open, openSearch, closeSearch, seed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSearch must be used inside <SearchProvider>");
  return ctx;
}
