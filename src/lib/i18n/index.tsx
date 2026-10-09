"use client";

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { GrammarSay } from "../quran/morphology";
import { useSettings } from "../store/settings";
import { en } from "./messages/en";
import { DEFAULT_LOCALE, isLocale, localeInfo, type LocaleId, type LocaleInfo } from "./locales";
import type { MessageKey, Messages, TafsirWords, Translate, Values } from "./types";

/**
 * The language the site is speaking, and the way every screen says anything.
 *
 * It is the language of the site's own words — the menus, the labels, the
 * messages a reader finds their way around by — and of nothing else. The
 * Qur'an, the translations under it and the tafsir are not its business: they
 * are chosen where they have always been chosen, and are the same whatever
 * language the site is in.
 *
 * The site is exported as plain files, in English, and there is no server to
 * hand a Pashto reader a Pashto page. So the language is a reader's setting,
 * chosen on the settings page and kept in the browser with the rest of them,
 * exactly as the reading light is: the opening script in <head> turns the
 * document to face the right way before anything is painted
 * (`LOCALE_BOOTSTRAP`), and this puts the words on it.
 *
 * English is part of the application. Every other language is its own file,
 * fetched only by the readers who read it — a Pashto reader does not carry the
 * Spanish, and an English reader carries neither.
 *
 * A language is not shown until its words have arrived. Until then the screen
 * stays in whatever it was already speaking, so changing language is one
 * change, not English for a moment and then the language asked for.
 */

interface Pack {
  messages: Messages;
  tafsir: TafsirWords | null;
  /** The parts of speech, by the corpus's tag, where the language has its own names for them. */
  pos: Record<string, string> | null;
}

const LOADERS: Record<Exclude<LocaleId, "en">, () => Promise<Pack>> = {
  ps: () => import("./messages/ps").then((m) => ({ messages: m.ps, tafsir: m.tafsirWords, pos: null })),
  fa: () => import("./messages/fa").then((m) => ({ messages: m.fa, tafsir: m.tafsirWords, pos: null })),
  es: () => import("./messages/es").then((m) => ({ messages: m.es, tafsir: m.tafsirWords, pos: m.posWords })),
};

const held = new Map<LocaleId, Pack>([["en", { messages: en, tafsir: null, pos: null }]]);
const asking = new Set<LocaleId>();
const listeners = new Set<() => void>();
let arrivals = 0;

function load(id: LocaleId) {
  if (id === "en" || held.has(id) || asking.has(id)) return;
  asking.add(id);
  LOADERS[id]()
    .then((pack) => {
      held.set(id, pack);
      arrivals += 1;
      listeners.forEach((l) => l());
    })
    // A language that could not be fetched is asked for again the next time it
    // is wanted; until then the site carries on in the language it was in.
    .catch(() => undefined)
    .finally(() => asking.delete(id));
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
};

// The reader's language is asked for as soon as this file is — before React
// has hydrated anything — so its words are on their way while the page is
// still being put together.
if (typeof window !== "undefined") {
  try {
    const stored = JSON.parse(localStorage.getItem("mishkat.settings.v1") || "{}") as { locale?: unknown };
    if (isLocale(stored.locale)) load(stored.locale);
  } catch {
    /* private mode, or settings edited into nonsense: English, until told otherwise */
  }
}

/** The language last put on screen, which is what stays there while another is fetched. */
let shown: LocaleId = DEFAULT_LOCALE;

export type Slots = Record<string, (children: string) => ReactNode>;

export interface LocaleContextValue {
  /** The language on screen. */
  locale: LocaleId;
  info: LocaleInfo;
  /** The language the reader chose, which is the one above once its words have arrived. */
  chosen: LocaleId;
  rtl: boolean;
  /** Whether the interface is written in Arabic script. */
  arabicScript: boolean;
  /** Whether surahs are named in Arabic alone. See `surahNames` in locales.ts. */
  arabicNames: boolean;
  /** Say a sentence. */
  t: Translate;
  /**
   * Say a sentence that has something set differently inside it — a link, a
   * stretch in bold. The sentence marks where, `<link>like this</link>`; the
   * screen says what the mark becomes.
   */
  rich: (key: MessageKey, slots: Slots, values?: Values) => ReactNode;
  /** A count, grouped as this language groups one: 6,236. */
  n: (value: number) => string;
  /** A day, as this language writes one. */
  date: (timestamp: number) => string;
  /**
   * Which way is on, and which way is back. An arrow is not a word and is not
   * translated, but it does depend on which way the page is read: "next" is
   * to the right of an English page and to the left of a Pashto one.
   */
  arrows: { next: string; prev: string };
  /** What this language says about the works of tafsir, if it says anything. */
  tafsirWords: TafsirWords | null;
  /** How the corpus's grammar is said to this reader. See lib/quran/morphology. */
  grammar: GrammarSay;
  setLocale: (locale: LocaleId) => void;
}

/** Hebrew through Arabic Extended-A, and the Arabic presentation forms. */
const RTL_LETTER = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;
/** Latin, with the accents and underdots a transliteration is written in. */
const LTR_LETTER = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;

/** First-strong isolate, and the mark that ends one. */
const FSI = "\u2068";
const PDI = "\u2069";

/**
 * A stretch of the other direction, set apart so that it cannot rearrange the
 * sentence it is put into.
 *
 * Text that runs one way inside text that runs the other is ordered by rules
 * that look at its neighbours, and the neighbours of a name are usually
 * numbers. Unguarded, a surah's Arabic name followed by an ayah number in a
 * Spanish sentence is drawn with the number on the far side of the name: it
 * is taken into the Arabic and laid out with it. An isolate is the instruction
 * for exactly this — treat what is inside as one thing — and is invisible,
 * and is what the message formats that solved this problem before all do.
 */
export function isolate(text: string, rtl: boolean): string {
  if (text.startsWith(FSI)) return text; // set apart already
  return (rtl ? LTR_LETTER : RTL_LETTER).test(text) ? `${FSI}${text}${PDI}` : text;
}

function fill(template: string, rtl: boolean, values?: Values): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!(name in values)) return whole;
    // A number that decides a plural has to arrive as a number, and a large
    // one wants writing as 6,236. `countText` beside `count` is how a screen
    // gives both: the first is counted with, the second is printed.
    const value = values[`${name}Text`] ?? values[name];
    return typeof value === "string" ? isolate(value, rtl) : String(value);
  });
}

function sayer(messages: Messages, plural: Intl.PluralRules, rtl: boolean): Translate {
  return (key, values) => {
    const entry = messages[key] ?? en[key];
    if (typeof entry === "string") return fill(entry, rtl, values);
    const form = entry[plural.select(Number(values?.count ?? 0)) as keyof typeof entry] ?? entry.other;
    return fill(form ?? "", rtl, values);
  };
}

/** `<name>words</name>`, and nothing nested: a sentence is not a document. */
const MARKED = /<(\w+)>([\s\S]*?)<\/\1>/g;

function setRich(text: string, slots: Slots): ReactNode {
  const out: ReactNode[] = [];
  let at = 0;
  for (const mark of text.matchAll(MARKED)) {
    const from = mark.index ?? 0;
    if (from > at) out.push(text.slice(at, from));
    const slot = slots[mark[1]];
    out.push(<Fragment key={from}>{slot ? slot(mark[2]) : mark[2]}</Fragment>);
    at = from + mark[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

function build(locale: LocaleId, chosen: LocaleId, setLocale: (locale: LocaleId) => void): LocaleContextValue {
  const info = localeInfo(locale);
  const pack = held.get(locale) ?? (held.get(DEFAULT_LOCALE) as Pack);
  const rtl = info.dir === "rtl";
  const t = sayer(pack.messages, new Intl.PluralRules(locale), rtl);
  const day = new Intl.DateTimeFormat(info.dates, { day: "numeric", month: "short", year: "numeric" });
  return {
    locale,
    info,
    chosen,
    rtl,
    arabicScript: info.script === "arabic",
    arabicNames: info.surahNames === "arabic",
    t,
    rich: (key, slots, values) => setRich(t(key, values), slots),
    n: (value) => value.toLocaleString(info.numbers),
    date: (timestamp) => day.format(new Date(timestamp)),
    arrows: rtl ? { next: "←", prev: "→" } : { next: "→", prev: "←" },
    tafsirWords: pack.tafsir,
    grammar: { t, arabicTerms: info.script === "arabic", pos: pack.pos },
    setLocale,
  };
}

const Ctx = createContext<LocaleContextValue>(build(DEFAULT_LOCALE, DEFAULT_LOCALE, () => {}));

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const chosen = settings.locale;

  // Read so that this renders again when a language's words arrive.
  useSyncExternalStore(
    subscribe,
    () => arrivals,
    () => 0,
  );

  const ready = held.has(chosen);
  const locale = ready ? chosen : shown;

  useEffect(() => {
    if (!ready) load(chosen);
  }, [chosen, ready]);

  // The document faces the way the language is read, and says which language
  // it is in — for the browser's own hyphenation and for a screen reader's
  // voice. Before paint, so the page never shows one language laid out for
  // another.
  useLayoutEffect(() => {
    shown = locale;
    const root = document.documentElement;
    const info = localeInfo(locale);
    root.lang = locale;
    root.dir = info.dir;
    root.dataset.script = info.script;
    // The page was held back by the opening script until it had its words.
    if (ready) delete root.dataset.i18nPending;
  }, [locale, ready]);

  const setLocale = useCallback((next: LocaleId) => update({ locale: next }), [update]);

  const value = useMemo(() => build(locale, chosen, setLocale), [locale, chosen, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(Ctx);
}

/** The one thing most screens want of the language: a way to say a sentence. */
export function useT(): Translate {
  return useContext(Ctx).t;
}

export type { MessageKey, Translate, Values } from "./types";
export { LOCALES, type LocaleId } from "./locales";
