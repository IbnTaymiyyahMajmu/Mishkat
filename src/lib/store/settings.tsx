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
  ARABIC_FONTS,
  arabicFontStack,
  DEFAULT_GLOSS_LANGUAGE,
  DEFAULT_RECITER,
  DEFAULT_TRANSLATION,
  GLOSS_LANGUAGES,
  MAX_TRANSLATIONS,
  RECITERS,
  type ArabicFontId,
} from "../quran/resources";
import { DEFAULT_TAFSIR_SHELF, reviveTafsirShelf, tafsirWork } from "../quran/tafsir";
import { DEFAULT_LOCALE, isLocale, type LocaleId } from "../i18n/locales";
import { createPersistedStore } from "./persisted";

export type Layout = "rows" | "stacked";
export type WordHighlight = "tint" | "underline" | "both";
export type Repeat = "off" | "ayah" | "surah";
/** The three grounds the site is read in. See the note in globals.css. */
export type Theme = "day" | "evening" | "night";

export const THEMES: Theme[] = ["day", "evening", "night"];

export interface Settings {
  /**
   * The language the site itself speaks: its menus, its labels, its messages.
   * That and nothing more — it is not the language of the translation under an
   * ayah, which is `translationIds`, and changing it changes none of the
   * settings below.
   */
  locale: LocaleId;
  /**
   * The translations set under each ayah, in the order they are set: any of
   * the corpus's, in any language, by its id there. Which ids are still
   * offered is the catalogue's to say and is checked against it once it has
   * arrived (`useTranslationShelf`); here an id only has to be one.
   */
  translationIds: number[];
  /**
   * The first of those, and never set on its own. It is the translation a
   * bookmark is saved in, a note quotes, and the search looks through — the
   * places that want one translation rather than a shelf of them.
   */
  translationId: number;
  /** The language the meaning under each word is given in. */
  glossLanguage: string;
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
  /**
   * The works the reader keeps to hand, in the order they chose them, by the
   * ids in `lib/quran/tafsir.ts`. They are the tabs of the tafsir panel.
   */
  tafsirShelf: string[];
  /** The one of those that was last being read, so the next ayah opens on it. */
  tafsirActive: string;
  /** How large tafsir is set, as a multiple of its ordinary size. */
  tafsirScale: number;
  /**
   * Whether the footnotes of a printed edition's editor are set out in the
   * passage they annotate, or folded to a mark that opens them.
   */
  tafsirNotes: boolean;
  follow: boolean;
  speed: number;
  repeat: Repeat;
  /**
   * How a passage is gone over when it is looped for memorising: each ayah this
   * many times, the passage this many times (0 is until stopped), and whether a
   * silence is left after each ayah to recite it back in. Which passage is not
   * kept — that belongs to a sitting, not to the reader.
   */
  loopEach: number;
  loopTimes: number;
  loopEcho: boolean;
}

export interface LastRead {
  surah: number;
  verseKey: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  locale: DEFAULT_LOCALE,
  translationIds: [DEFAULT_TRANSLATION],
  translationId: DEFAULT_TRANSLATION,
  glossLanguage: DEFAULT_GLOSS_LANGUAGE,
  arabicFont: "amiri-quran",
  arabicSize: 40,
  transSize: 15,
  showTranslit: true,
  showWbw: true,
  showTranslation: true,
  layout: "rows",
  // Evening is the light the site was drawn in, and the one the landing page's
  // niche belongs to; day and night are departures from it.
  theme: "evening",
  reciterId: DEFAULT_RECITER,
  wordHighlight: "both",
  readerWidth: 780,
  tafsirShelf: DEFAULT_TAFSIR_SHELF,
  tafsirActive: DEFAULT_TAFSIR_SHELF[0],
  tafsirScale: 1,
  tafsirNotes: false,
  follow: true,
  speed: 1,
  repeat: "off",
  loopEach: 3,
  loopTimes: 3,
  loopEcho: false,
};

/** Keep a hand-edited or stale stored value from breaking the reader. */
function sanitise(stored: unknown, fallback: Settings): Settings {
  const s = { ...fallback, ...(stored as Partial<Settings> | null) };
  // The shelf is read out of whatever was stored — including the two lists it
  // used to be kept as — and anything naming a work no longer held is dropped,
  // or it would show as a tab that opens on nothing.
  const { tafsirIds: _corpusIds, tafsirAppIds: _appIds, ...rest } = s as Settings & {
    tafsirIds?: unknown;
    tafsirAppIds?: unknown;
  };
  const tafsirShelf = reviveTafsirShelf({
    tafsirShelf: (stored as { tafsirShelf?: unknown } | null)?.tafsirShelf,
    tafsirIds: _corpusIds,
    tafsirAppIds: _appIds,
  });
  // Read off what was stored, not off the merge above: a reader from before
  // there was a shelf has no shelf stored, and the merge would hand them the
  // default one in place of the translation they chose.
  const translationIds = reviveTranslations(
    (stored as { translationIds?: unknown } | null)?.translationIds,
    s.translationId,
    fallback.translationIds,
  );
  return {
    ...rest,
    locale: isLocale(s.locale) ? s.locale : fallback.locale,
    translationIds,
    translationId: translationIds[0],
    glossLanguage: GLOSS_LANGUAGES.some((g) => g.id === s.glossLanguage) ? s.glossLanguage : fallback.glossLanguage,
    reciterId: RECITERS.some((r) => r.id === s.reciterId) ? s.reciterId : fallback.reciterId,
    arabicFont: ARABIC_FONTS.some((f) => f.id === s.arabicFont) ? s.arabicFont : fallback.arabicFont,
    arabicSize: clamp(s.arabicSize, 26, 72),
    transSize: clamp(s.transSize, 12, 26),
    readerWidth: clamp(s.readerWidth, 640, 1100),
    speed: clamp(s.speed, 0.5, 2),
    tafsirShelf,
    tafsirActive: tafsirShelf.includes(s.tafsirActive) && tafsirWork(s.tafsirActive) ? s.tafsirActive : tafsirShelf[0],
    tafsirScale: Math.round(clamp(s.tafsirScale, 0.85, 1.6) * 100) / 100,
    tafsirNotes: !!s.tafsirNotes,
    layout: s.layout === "stacked" ? "stacked" : "rows",
    theme: THEMES.includes(s.theme) ? s.theme : fallback.theme,
    repeat: s.repeat === "ayah" || s.repeat === "surah" ? s.repeat : "off",
    loopEach: Math.round(clamp(s.loopEach, 1, 20)),
    loopTimes: Math.round(clamp(s.loopTimes, 0, 20)),
    loopEcho: !!s.loopEcho,
  };
}

/**
 * The shelf of translations, out of whatever was stored. Before there was a
 * shelf there was one translation, and a reader who chose it then still has
 * it: it becomes a shelf of one.
 */
function reviveTranslations(stored: unknown, single: unknown, fallback: number[]): number[] {
  const one = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
  const ids = Array.isArray(stored) ? stored.filter(one) : one(single) ? [single] : [];
  const shelf = [...new Set(ids)].slice(0, MAX_TRANSLATIONS);
  return shelf.length ? shelf : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/** A stored place is only a place if it names a surah there is. */
function reviveLastRead(stored: unknown): LastRead | null {
  if (!stored || typeof stored !== "object") return null;
  const { surah, verseKey } = stored as Partial<LastRead>;
  if (typeof surah !== "number" || !Number.isInteger(surah) || surah < 1 || surah > 114) return null;
  return { surah, verseKey: typeof verseKey === "string" ? verseKey : null };
}

/**
 * How long a change of reading light takes. Must match the duration in the
 * `[data-light-changing]` rule in globals.css.
 */
const LIGHT_MS = 500;

let lightTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Move the whole document to another reading light.
 *
 * Every colour on the site is a `--mk-*` token on the document element, so the
 * change itself is one attribute. Making it *look* like one change is the
 * harder half: hundreds of elements read those tokens, and each would otherwise
 * move on whatever transition it happens to declare — the landing page's ground
 * over 700ms, the header over 300ms, and everything that simply states
 * `color: var(--mk-hero-ink)` not at all. The result was a light that arrived in
 * instalments.
 *
 * So the change is made inside a window that lends every element the same
 * transition, and takes it away again once the light has arrived. Nothing
 * carries a transition it did not ask for outside those five hundred
 * milliseconds, and inside them the whole page turns together.
 *
 * The order matters. The window has to be open, and a style recalc has to have
 * run under it, before the tokens change: a transition interpolates from the
 * style an element had when the change landed, so if the window opened in the
 * same pass there would be nothing to move from.
 */
function setTheme(root: HTMLElement, theme: Theme) {
  const previous = root.dataset.theme;

  // Nothing to fade. Either this is the first application — the inline script
  // has already put the reader's light on the element, and it should not
  // dissolve on arrival — or the reader has asked for the light they are in.
  const changing = !!previous && previous !== theme;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (changing && !still) {
    root.dataset.lightChanging = "";
    void root.offsetHeight; // fix the old light as the style to move from
  }

  root.dataset.theme = theme;

  if (lightTimer) clearTimeout(lightTimer);
  if (changing && !still) {
    lightTimer = setTimeout(() => {
      delete root.dataset.lightChanging;
      lightTimer = null;
    }, LIGHT_MS + 60);
  } else {
    delete root.dataset.lightChanging;
  }
}

const settingsStore = createPersistedStore<Settings>("mishkat.settings.v1", DEFAULT_SETTINGS, sanitise);

const lastReadStore = createPersistedStore<LastRead | null>("mishkat.last.v1", null, reviveLastRead);

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
    setTheme(root, settings.theme);
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

  // The language the site is in is not a reading setting, and is kept: a
  // reader putting the type size back should not find the page in English.
  const reset = useCallback(
    () => settingsStore.set({ ...DEFAULT_SETTINGS, locale: settingsStore.getSnapshot().locale }),
    [],
  );
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
