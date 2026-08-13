import intros from "@/content/surah-intros.json";

/**
 * Locally authored content, which takes precedence over the corpus.
 *
 * The corpus can say what a surah *is*; it cannot say what it is *about* in a
 * voice this product chose. Anything written into `src/content` wins, and is
 * attributed to whoever wrote it — see `src/content/README.md` for the shape.
 */

export interface SurahIntro {
  title?: string;
  source: string;
  sourceUrl?: string;
  revealed?: string;
  themes?: string[];
  paragraphs: string[];
  arabicParagraphs?: string[];
}

const table = (intros as { intros?: Record<string, SurahIntro> }).intros ?? {};

export function localSurahIntro(surah: number): SurahIntro | null {
  const entry = table[String(surah)];
  if (!entry || !Array.isArray(entry.paragraphs) || entry.paragraphs.length === 0) return null;
  if (!entry.source) return null; // an unattributed introduction is not published
  return entry;
}

/** How many surahs have a written introduction. Reported on the settings page. */
export function localIntroCount(): number {
  return Object.keys(table).filter((k) => localSurahIntro(+k)).length;
}
