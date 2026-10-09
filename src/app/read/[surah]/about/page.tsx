import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SurahIntro } from "@/components/intro/SurahIntro";
import { aimArabic, loadIntro, wordsByAyah } from "@/lib/intros/load";
import { SURAH_NAMES } from "@/lib/quran/surahNames";

/**
 * The introduction to a surah, as a page of its own: `/read/18/about/`.
 *
 * It used to be a paragraph that unfolded under the surah's name, borrowed
 * from another work. It is now the thing a reader opens *before* the surah —
 * where it came down and when, what was happening, what it is for, how it is
 * laid out, what is narrated about it — and that is more than a fold in a
 * header can hold.
 *
 * One page per surah is prerendered, with the introduction in it. It is read
 * from `src/content/intros` while the export is made; see `lib/intros/load.ts`.
 */
export function generateStaticParams() {
  return SURAH_NAMES.map((_, i) => ({ surah: String(i + 1) }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ surah: string }>;
}): Promise<Metadata> {
  const { surah } = await params;
  const n = Number(surah);
  const name = SURAH_NAMES[n - 1];
  if (!name) return { title: "Introduction" };
  const intro = loadIntro(n);
  return {
    title: `${name.english} · An introduction`,
    description:
      intro?.lede ??
      `An introduction to Surah ${name.english} (${name.arabic}): where and when it was revealed, what it is about, and how it is laid out.`,
  };
}

export default async function IntroPage({ params }: { params: Promise<{ surah: string }> }) {
  const { surah } = await params;
  const n = Number(surah);
  if (!Number.isInteger(n) || n < 1 || n > 114) notFound();
  // Keyed on the surah, as the reader is: which passage is picked out on the
  // medallion belongs to one surah and should not follow the reader to the next.
  return <SurahIntro key={n} surah={n} intro={loadIntro(n)} aimArabic={aimArabic(n)} ayahWords={wordsByAyah(n)} />;
}
