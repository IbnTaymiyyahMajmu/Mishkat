import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HorizonsPage } from "@/components/horizons/HorizonsPage";
import { SURAH_NAMES } from "@/lib/quran/surahNames";

/**
 * The surah recited over the signs it names: one pre-rendered page per surah,
 * like the reader, the muṣḥaf and the introduction beside it.
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
  const name = SURAH_NAMES[Number(surah) - 1];
  if (!name) return { title: "Horizons" };
  return {
    title: `${name.english} · Horizons`,
    description: `Surah ${name.english} (${name.arabic}) recited over the signs it names — the sky, the sea, the rain, the mountains — in one unbroken flight that turns with each word.`,
  };
}

export default async function HorizonsRoute({ params }: { params: Promise<{ surah: string }> }) {
  const { surah } = await params;
  const n = Number(surah);
  if (!Number.isInteger(n) || n < 1 || n > 114) notFound();
  return <HorizonsPage key={n} surah={n} />;
}
