"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SURAH_NAMES } from "../quran/surahNames";
import { useLocale } from "./index";
import type { Translate } from "./types";

/** What the tab should say for the page at this address, in this language. */
function titleFor(pathname: string, t: Translate, arabicNames: boolean): string {
  const page = (name: string) => t("title.page", { page: name });
  if (pathname === "/") return t("title.home");

  const read = /^\/read\/(\d+)\/(mushaf\/?|about\/?)?$/.exec(pathname);
  if (read) {
    const n = Number(read[1]);
    const surah = SURAH_NAMES[n - 1];
    const name = surah ? (arabicNames ? surah.arabic : surah.english) : t("common.surahN", { n });
    if (read[2]?.startsWith("about")) return page(t("title.intro", { surah: name }));
    return page(read[2] ? t("title.mushaf", { surah: name }) : `${name} · ${t("common.surahN", { n })}`);
  }
  if (pathname.startsWith("/surahs")) return page(t("title.surahs"));
  if (pathname.startsWith("/tafsir")) return page(t("nav.tafsir"));
  if (pathname.startsWith("/notes")) return page(t("notes.title"));
  if (pathname.startsWith("/bookmarks")) return page(t("bookmarks.title"));
  if (pathname.startsWith("/settings")) return page(t("settings.title"));
  if (pathname.startsWith("/study")) return page(t("title.study"));
  return t("title.home");
}

/**
 * The title of the page, in the reader's language.
 *
 * The titles are part of each exported file and are written in English: they
 * are what a search result shows, and a link to a surah should have a real
 * title before any script has run. But the same title is what the tab and the
 * history say, and there it should be in the language of the page. So where
 * the site is not in English the title is said again here — and said again
 * whenever the framework, moving to another page, puts the English one back.
 *
 * In English nothing is done: the build's own titles are the right ones.
 */
export function DocumentTitle() {
  const pathname = usePathname() || "/";
  const { locale, t, arabicNames } = useLocale();

  useEffect(() => {
    if (locale === "en") return;
    const wanted = titleFor(pathname, t, arabicNames);
    const say = () => {
      if (document.title !== wanted) document.title = wanted;
    };
    say();
    const watching = new MutationObserver(say);
    watching.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => watching.disconnect();
  }, [pathname, locale, t, arabicNames]);

  return null;
}
