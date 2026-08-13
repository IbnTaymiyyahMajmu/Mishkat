import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reader } from "@/components/reader/Reader";
import { SURAH_NAMES } from "@/lib/quran/surahNames";

/**
 * One pre-rendered page per surah. The text itself arrives in the browser, but
 * the route, the title and the description are baked at build time, so a link
 * to a surah is a real page with a real title in a search result — not a shell
 * that says "Mishkāt" and fills in later.
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
  if (!name) return { title: "Surah" };
  return {
    title: `${name.english} · Surah ${n}`,
    description: `Read Surah ${name.english} (${name.arabic}) — ${name.meaning} — word by word, with translation, tafsir and recitation.`,
  };
}

export default async function ReaderPage({ params }: { params: Promise<{ surah: string }> }) {
  const { surah } = await params;
  const n = Number(surah);
  if (!Number.isInteger(n) || n < 1 || n > 114) notFound();
  // Keyed on the surah so moving between surahs is a remount, not a prop
  // change: the rendered window, the open panel and any pending scroll all
  // belong to one surah, and none of them should survive into the next.
  return <Reader key={n} surah={n} />;
}
