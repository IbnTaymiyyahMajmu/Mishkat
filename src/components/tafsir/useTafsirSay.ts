"use client";

import { useMemo } from "react";
import {
  TAFSIR_SHELVES,
  tafsirCounterpart,
  type TafsirLang,
  type TafsirSection,
  type TafsirShelf,
  type TafsirWork,
} from "@/lib/quran/tafsir";
import { useLocale } from "@/lib/i18n";

/** How the library is put into the reader's language. */
export interface TafsirSay {
  /** The shelves of the library: the same two, whatever language the site is in. */
  shelves: TafsirShelf[];
  /** What a language is called: "Arabic", "عربي". */
  language: (lang: TafsirLang) => string;
  /** The two letters a tab is marked with, to say which language the work is in. */
  badge: (lang: TafsirLang) => string;
  shelfNote: (shelf: TafsirShelf) => string;
  section: (section: TafsirSection) => string;
  /** What the work is called on a tab. */
  short: (work: TafsirWork) => string;
  /** The title of the book. */
  name: (work: TafsirWork) => string;
  /** What goes under the title: its meaning, or the name the book goes by. */
  title: (work: TafsirWork) => string;
  /** The title in Arabic, where the two above are not already Arabic. */
  arabic: (work: TafsirWork) => string;
  credit: (work: TafsirWork) => string;
  by: (work: TafsirWork) => string;
  era: (work: TafsirWork) => string;
  kind: (work: TafsirWork) => string;
  about: (work: TafsirWork) => string;
  /** The same work in the other language this reader would want it in. */
  counterpart: (work: TafsirWork | undefined) => { work: TafsirWork; partial: boolean } | undefined;
}

const BADGES: Record<TafsirLang, string> = { ar: "ع", en: "EN" };

/**
 * The tafsir library, said in the reader's language.
 *
 * The library is a table written once (lib/quran/tafsir.ts), and a table of
 * books is three kinds of thing. The headings and the dates are sentences, and
 * are said from the site's messages. What each work *is* — the one line that
 * lets someone choose a book they have never heard of — is written out per
 * language, beside that language's messages. And the names are names: an
 * author is not translated. But a name can be written in two scripts, and a
 * reader of Pashto or Persian is shown الطبري, not "al-Ṭabarī": the Latin is a
 * transliteration made for people who cannot read the original, and they can.
 *
 * In English nothing here changes anything; every line comes back as the
 * table has it. And in no language does it change what there is to read: the
 * library is the same two shelves, and only the words describing it differ.
 */
export function useTafsirSay(): TafsirSay {
  const { t, arabicScript, tafsirWords: words } = useLocale();

  return useMemo(() => {
    // "d. 310 AH", wherever it stands in a credit, as this language writes it.
    const dates = (text: string) =>
      text
        .replace(/d\. (\d+) and (\d+) AH/g, (_, first: string, second: string) =>
          t("tafsir.diedTwo", { first: Number(first), second: Number(second) }),
        )
        .replace(/d\. (\d+) AH/g, (_, year: string) => t("tafsir.died", { year: Number(year) }))
        .replace(/d\. (\d{4})(?! AH)/g, (_, year: string) => t("tafsir.diedCE", { year: Number(year) }));

    const died = (work: TafsirWork) => /d\. [\d and]+(?: AH)?/.exec(work.credit)?.[0];
    const classical = (work: TafsirWork) => work.id.startsWith("app:");
    const meaning = (work: TafsirWork) => words?.titles[work.id] ?? (words ? "" : (work.nameEnglish ?? ""));

    return {
      shelves: TAFSIR_SHELVES,
      language: (lang) => t(`tafsir.lang.${lang}`),
      badge: (lang) => BADGES[lang],
      shelfNote: (shelf) => t(`tafsir.shelf.${shelf.lang}`),
      section: (section) => t(`tafsir.section.${section.id}`),

      short: (work) => (arabicScript && work.shortArabic) || work.short,
      name: (work) => (arabicScript && (work.titleArabic ?? work.nameArabic)) || work.name,
      title: (work) => {
        if (!arabicScript) return meaning(work);
        // Under the book's own title, the name it goes by — where they differ.
        return work.titleArabic && work.nameArabic && work.nameArabic !== work.titleArabic ? work.nameArabic : "";
      },
      arabic: (work) => (arabicScript ? "" : (work.nameArabic ?? "")),
      credit: (work) => {
        const said = words?.credits[work.id];
        if (said) return said;
        if (arabicScript && work.authorArabic) {
          const when = died(work);
          return when ? `${work.authorArabic} (${dates(when)})` : work.authorArabic;
        }
        return dates(work.credit);
      },
      by: (work) => {
        const said = words?.by[work.id];
        if (said) return said;
        // A classical work's row says what its title means; in Arabic script
        // the title is its own meaning.
        if (classical(work)) return arabicScript ? (work.titleArabic ?? work.by) : meaning(work) || work.by;
        return (arabicScript && work.authorArabic) || work.by;
      },
      era: (work) => (/d\. \d/.test(work.era) ? dates(work.era) : (arabicScript && work.authorArabic) || work.era),
      kind: (work) => words?.kinds[work.kind] ?? work.kind,
      about: (work) => words?.about[work.id] ?? work.about,
      counterpart: (work) => tafsirCounterpart(work),
    };
  }, [t, arabicScript, words]);
}
