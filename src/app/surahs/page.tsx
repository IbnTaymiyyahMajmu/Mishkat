import type { Metadata } from "next";
import { SurahIndex } from "@/components/surahs/SurahIndex";

export const metadata: Metadata = {
  title: "Every surah",
  description: "Every surah of the Qur'an, with its Arabic name, its meaning and its length.",
};

export default function SurahsPage() {
  return <SurahIndex />;
}
