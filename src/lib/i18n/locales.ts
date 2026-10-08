/**
 * The languages the site itself can speak.
 *
 * This is the interface — the menus, the labels, the messages a reader finds
 * their way around by — and nothing else. It is chosen on the settings page.
 * It does not touch what is read: the translation under each ayah, the word
 * meanings and the tafsir are the reader's own choices, made where they have
 * always been made, and turning the site to Pashto leaves every one of them
 * exactly as it was.
 *
 * Adding a language is one entry here and one file beside this one
 * (`messages/<id>.ts`). The compiler holds a new file to the English one key
 * for key, so a language cannot be added with a screen left unsaid.
 */

export type LocaleId = "en" | "ps" | "fa" | "es";

export interface LocaleInfo {
  id: LocaleId;
  /** What the language calls itself, which is how a reader finds it. */
  label: string;
  /** …and what English calls it, for the title of a control. */
  name: string;
  dir: "ltr" | "rtl";
  /**
   * The script the interface is written in. An Arabic-script language is set
   * in an Arabic face, without the letter-spacing and the small capitals the
   * Latin design leans on — both of which take a joined script apart.
   */
  script: "latin" | "arabic";
  /**
   * How a surah is named. English gives the name in Latin letters with its
   * meaning — "Al-Mulk · The Sovereignty". Every other language gives the
   * Arabic name and nothing else: a reader who does not read English cannot
   * tell "Ta Ha" from "Al-Mulk", and can read طه and الملك whatever language
   * the rest of the page is in. Set this to "latin" to give a language the
   * English treatment instead.
   */
  surahNames: "latin" | "arabic";
  /** How dates are written, with the digits kept the ones used everywhere else. */
  dates: string;
  /** How a number is grouped: 6,236 or 6.236. */
  numbers: string;
}

export const LOCALES: LocaleInfo[] = [
  { id: "en", label: "English", name: "English", dir: "ltr", script: "latin", surahNames: "latin", dates: "en", numbers: "en-US" },
  { id: "ps", label: "پښتو", name: "Pashto", dir: "rtl", script: "arabic", surahNames: "arabic", dates: "ps-u-nu-latn", numbers: "en-US" },
  { id: "fa", label: "فارسی", name: "Persian", dir: "rtl", script: "arabic", surahNames: "arabic", dates: "fa-u-nu-latn", numbers: "en-US" },
  { id: "es", label: "Español", name: "Spanish", dir: "ltr", script: "latin", surahNames: "arabic", dates: "es", numbers: "es" },
];

export const DEFAULT_LOCALE: LocaleId = "en";

const BY_ID = new Map(LOCALES.map((l) => [l.id, l]));

export function localeInfo(id: LocaleId): LocaleInfo {
  return BY_ID.get(id) ?? LOCALES[0];
}

export function isLocale(value: unknown): value is LocaleId {
  return typeof value === "string" && BY_ID.has(value as LocaleId);
}

/**
 * The part of the page's opening script that sets the language.
 *
 * It runs in <head> beside the one that sets the reading light, for the same
 * reason: so the document is facing the right way before anything is painted.
 * The pages are exported in English, and a reader who has chosen another
 * language would otherwise watch the English arrive, turn round and be
 * replaced. So where the language is not English the page is held back —
 * `data-i18n-pending`, see globals.css — until the interface has its words,
 * and let go after four seconds whatever has happened, so a script that failed
 * cannot leave a blank page behind it.
 *
 * Written out of the table above rather than by hand, so that the script and
 * the application cannot come to disagree about which languages there are.
 * `s` is the stored settings and `d` the document element, both already in
 * hand in the script this is spliced into.
 */
export const LOCALE_BOOTSTRAP = (() => {
  const known = LOCALES.filter((l) => l.id !== DEFAULT_LOCALE).map((l) => l.id);
  const rtl = LOCALES.filter((l) => l.dir === "rtl").map((l) => l.id);
  const arabic = LOCALES.filter((l) => l.script === "arabic").map((l) => l.id);
  return (
    `var l=s.locale;if(${JSON.stringify(known)}.indexOf(l)>-1){d.lang=l;` +
    `d.dir=${JSON.stringify(rtl)}.indexOf(l)>-1?'rtl':'ltr';` +
    `d.dataset.script=${JSON.stringify(arabic)}.indexOf(l)>-1?'arabic':'latin';` +
    `d.dataset.i18nPending='';setTimeout(function(){delete d.dataset.i18nPending},4000)}`
  );
})();
