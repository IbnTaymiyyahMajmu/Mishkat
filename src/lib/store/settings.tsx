"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  arabicFontStack,
  DEFAULT_RECITER,
  DEFAULT_TAFSIRS,
  DEFAULT_TRANSLATION,
  type ArabicFontId,
} from "../quran/resources";
import { createPersistedStore } from "./persisted";

export type Layout = "rows" | "stacked";
export type WordHighlight = "tint" | "underline" | "both";
export type Repeat = "off" | "ayah" | "surah";
export type Theme = "day" | "night";

export interface Settings {
  translationId: number;
  arabicFont: ArabicFontId;
  arabicSize: number;
  transSize: number;
  showTranslit: boolean;
  showWbw: boolean;
  showTranslation: boolean;
  layout: Layout;
  theme: Theme;
  reciterId: number;
  wordHighlight: WordHighlight;
  readerWidth: number;
  tafsirIds: number[];
  follow: boolean;
  speed: number;
  repeat: Repeat;
}

export interface LastRead {
  surah: number;
  verseKey: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  translationId: DEFAULT_TRANSLATION,
  arabicFont: "amiri-quran",
  arabicSize: 40,
  transSize: 15,
  showTranslit: true,
  showWbw: true,
  showTranslation: true,
  layout: "rows",
  theme: "day",
  reciterId: DEFAULT_RECITER,
  wordHighlight: "both",
  readerWidth: 780,
  tafsirIds: DEFAULT_TAFSIRS,
  follow: true,
  speed: 1,
  repeat: "off",
};

/** Keep a hand-edited or stale stored value from breaking the reader. */
function sanitise(stored: unknown, fallback: Settings): Settings {
  const s = { ...fallback, ...(stored as Partial<Settings> | null) };
  return {
    ...s,
    arabicSize: clamp(s.arabicSize, 26, 72),
    transSize: clamp(s.transSize, 12, 26),
    readerWidth: clamp(s.readerWidth, 640, 1100),
    speed: clamp(s.speed, 0.5, 2),
    tafsirIds: Array.isArray(s.tafsirIds) && s.tafsirIds.length ? s.tafsirIds : DEFAULT_TAFSIRS,
    layout: s.layout === "stacked" ? "stacked" : "rows",
    theme: s.theme === "night" ? "night" : "day",
    repeat: s.repeat === "ayah" || s.repeat === "surah" ? s.repeat : "off",
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

const settingsStore = createPersistedStore<Settings>("mishkat.settings.v1", DEFAULT_SETTINGS, sanitise);

const lastReadStore = createPersistedStore<LastRead | null>(
  "mishkat.last.v1",
  null,
  (stored) => (stored && typeof stored === "object" ? (stored as LastRead) : null),
);

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  lastRead: LastRead | null;
  setLastRead: (v: LastRead) => void;
}

const Ctx = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.getSnapshot,
    settingsStore.getServerSnapshot,
  );
  const lastRead = useSyncExternalStore(
    lastReadStore.subscribe,
    lastReadStore.getSnapshot,
    lastReadStore.getServerSnapshot,
  );

  // Type size, face and reader width are applied as custom properties on the
  // document, not as React props. A verse tree can be thousands of nodes; the
  // reader dragging the size slider must not re-render one of them.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--arabic-font", arabicFontStack(settings.arabicFont));
    root.style.setProperty("--arabic-size", `${settings.arabicSize}px`);
    root.style.setProperty("--trans-size", `${settings.transSize}px`);
    root.style.setProperty("--reader-max", `${settings.readerWidth}px`);
    root.dataset.theme = settings.theme;
  }, [
    settings.arabicFont,
    settings.arabicSize,
    settings.transSize,
    settings.readerWidth,
    settings.theme,
  ]);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      settingsStore.set(sanitise({ ...settingsStore.getSnapshot(), ...patch }, DEFAULT_SETTINGS));
    },
    [],
  );

  const reset = useCallback(() => settingsStore.set(DEFAULT_SETTINGS), []);
  const setLastRead = useCallback((v: LastRead) => lastReadStore.set(v), []);

  const value = useMemo(
    () => ({ settings, update, reset, lastRead, setLastRead }),
    [settings, update, reset, lastRead, setLastRead],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
