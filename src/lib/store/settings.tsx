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
import { DEFAULT_QARI, isQari, type QariId } from "../audio/qari";

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
  /** Whether the rules of tajweed are drawn in colour in the reader and the muṣḥaf. */
  tajweed: boolean;
  /** The Qari whose voice a word is heard in, in the tajweed panel. See lib/audio/qari.ts. */
  qari: QariId;
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
  tajweed: false,
  qari: DEFAULT_QARI,
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
    tajweed: !!s.tajweed,
    qari: isQari(s.qari) ? s.qari : fallback.qari,
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
 * Move the whole document to another reading light.
 *
 * Every colour on the site is a `--mk-*` token on the document element, so the
 * change itself is one attribute. Making it *look* like one change is the
 * harder half: each element reading those tokens would otherwise move on
 * whatever transition it happens to declare, and the light would arrive in
 * instalments.
 *
 * So the change is made as a view transition: the browser keeps a picture of
 * the page in the old light, makes the change underneath it, and dissolves the
 * picture into the new light (the duration is in globals.css). The whole page
 * turns as one, and it costs the same on a surah of two hundred ayat as on the
 * landing page. It used to be done by lending every element a transition for
 * the length of the change, which on a long surah meant some eighteen thousand
 * elements restyled on every frame — seconds of a frozen page, with the words
 * half-faded while it struggled.
 *
 * Where the browser has no view transitions, or the reader has asked for
 * stillness, the light simply changes.
 *
 * A dissolve puts its light on the element a frame or more after it is asked
 * for, so the element is not a record of what was last chosen. That is kept
 * here instead, and it is what a dissolve applies when it comes to land: a
 * change asked for earlier must never arrive after one asked for since, and
 * leave the page in a light the buttons say it is not in.
 */
let wantedTheme: Theme | null = null;

/** How many dissolves are under way; while any is, nothing transitions (see below). */
let dissolving = 0;

/**
 * Applies a light to the document, dissolving into it when it is a change.
 * Returns once the light is on the page — at the end of the dissolve, if
 * there is one.
 *
 * While a dissolve runs, the document carries `data-changing`, and nothing on
 * the page runs a transition of its own (globals.css). The bar, the buttons
 * and the panels each declare one for their colours; under a dissolve that
 * already carries the page from one light to the other, those would only
 * repaint the page on every frame of it, which a phone shows as a stutter.
 */
function setTheme(root: HTMLElement, theme: Theme): Promise<void> {
  const previous = wantedTheme ?? root.dataset.theme;
  wantedTheme = theme;

  // Nothing to fade. Either this is the first application — the inline script
  // has already put the reader's light on the element, and it should not
  // dissolve on arrival — or the reader has asked for the light they are in.
  const changing = !!previous && previous !== theme;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (changing && !still && typeof document.startViewTransition === "function") {
    dissolving++;
    const transition = document.startViewTransition(() => {
      root.dataset.changing = "";
      root.dataset.theme = wantedTheme ?? theme;
    });
    // The browser skips the dissolve when it cannot show one — a hidden tab,
    // or another change of light before this one has finished — and says so
    // by rejecting `ready`. The light has changed all the same.
    transition.ready.catch(() => {});
    return transition.finished
      .catch(() => {})
      .finally(() => {
        if (--dissolving === 0) delete root.dataset.changing;
      });
  }
  root.dataset.theme = theme;
  return Promise.resolve();
}

/**
 * The reader choosing a light, from the bar or the settings page.
 *
 * The dissolve starts on the tap itself. The setting is kept — and with it
 * everything that reads the settings drawn again — only once the dissolve
 * is over, when nothing on the page is moving: done first, it would hold the
 * dissolve back by however long the whole page takes to draw, which on a phone
 * is long enough to feel. What has to change with the light — the sky, which
 * of the three buttons is lit — reads it from the page (`useLight`) and turns
 * inside the dissolve. A light chosen and then changed before its dissolve has
 * ended is not kept; the one chosen last is.
 */
export function chooseLight(theme: Theme) {
  const keep = () => {
    if (wantedTheme !== theme || settingsStore.getSnapshot().theme === theme) return;
    settingsStore.set(sanitise({ ...settingsStore.getSnapshot(), theme }, DEFAULT_SETTINGS));
  };
  void setTheme(document.documentElement, theme).then(keep);
}

function subscribeLight(onChange: () => void) {
  const watch = new MutationObserver(onChange);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => watch.disconnect();
}

function lightOnPage(): Theme {
  const light = document.documentElement.dataset.theme;
  return light === "day" || light === "night" ? light : "evening";
}

/**
 * The light the page is in, read from the page — so it changes inside the
 * dissolve, with the colours, rather than after it with the setting. Before
 * the page is in the browser it is the default, as the settings are.
 */
export function useLight(): Theme {
  return useSyncExternalStore(subscribeLight, lightOnPage, () => DEFAULT_SETTINGS.theme);
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
    // Read from the store, not from this render. The first render in the
    // browser is hydration, drawn from the server's settings — the defaults —
    // and its effects run before React draws again with the reader's own. Its
    // light is evening for everyone, and applying it would start a reader of
    // day or night dissolving into evening on arrival.
    void setTheme(root, settingsStore.getSnapshot().theme);
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
