import { readFileSync } from "node:fs";
import path from "node:path";
import aims from "@/content/surah-aims.json";
import ayahWords from "@/content/ayah-words.json";
import type { Intro, IntroTeaser } from "./types";

/**
 * Reading an introduction off the disk, at build time.
 *
 * The site is exported as files, so this runs once per surah while the export
 * is being made and never again: the introduction is in the page's own HTML,
 * there to be read before a line of script has run, and there for a search
 * engine to find. Nothing here reaches a browser — the 114 introductions are
 * not a bundle every reader carries, only the one page they opened.
 *
 * Each introduction is its own file, `src/content/intros/<n>.json`, so that
 * one can be corrected without touching another; `src/content/README.md` says
 * what goes in one.
 */

const DIR = path.join(process.cwd(), "src", "content", "intros");

/** A surah's introduction, or null where none has been written yet. */
export function loadIntro(surah: number): Intro | null {
  try {
    return JSON.parse(readFileSync(path.join(DIR, `${surah}.json`), "utf8")) as Intro;
  } catch {
    return null;
  }
}

/** The two lines of it the reader shows at the head of the surah. */
export function loadTeaser(surah: number): IntroTeaser | null {
  const intro = loadIntro(surah);
  return intro ? { epithet: intro.epithet, lede: intro.lede } : null;
}

/** What al-Mukhtaṣar says the surah is for, in its own Arabic. */
export function aimArabic(surah: number): string {
  return (aims as string[])[surah - 1] ?? "";
}

/** How many words each ayah of the surah has: what its map is drawn to scale by. */
export function wordsByAyah(surah: number): number[] {
  return (ayahWords as number[][])[surah - 1] ?? [];
}
