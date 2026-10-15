import type { Metadata } from "next";
import { Suspense } from "react";
import { QuestionsPage } from "@/components/questions/QuestionsPage";

export const metadata: Metadata = {
  title: "The Qur'an asks",
  description:
    "Every question in the Qur'an — by Allah, by His prophets, by believers and deniers, by angels and by Iblīs — gathered in the order of the muṣḥaf, with who asks each and of whom.",
};

/**
 * The questions of the Qurʾān, as a page: `/questions/`, or `/questions/?s=19`
 * for one surah's. The surah is a query rather than a path for the reason the
 * tafsir page gives, and the boundary is there because reading one suspends.
 */
export default function Questions() {
  return (
    <Suspense fallback={null}>
      <QuestionsPage />
    </Suspense>
  );
}
