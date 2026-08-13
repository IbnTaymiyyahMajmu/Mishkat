import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MushafReader } from "@/components/mushaf/MushafReader";
import { SURAH_NAMES } from "@/lib/quran/surahNames";

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
  if (!name) return { title: "Muṣḥaf" };
  return {
    title: `${name.english} · Muṣḥaf`,
    description: `Surah ${name.english} (${name.arabic}) as continuous Arabic text, without translation or transliteration.`,
  };
}

export default async function MushafPage({ params }: { params: Promise<{ surah: string }> }) {
  const { surah } = await params;
  const n = Number(surah);
  if (!Number.isInteger(n) || n < 1 || n > 114) notFound();
  return <MushafReader surah={n} />;
}
