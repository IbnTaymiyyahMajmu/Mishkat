import type { Metadata } from "next";
import { Suspense } from "react";
import { WordStudy } from "@/components/study/WordStudy";

export const metadata: Metadata = {
  title: "Study a word",
  description:
    "One word of the Qur'an in full: its segments and their grammar, its root, everywhere it occurs, and the classical lexicons on it.",
};

/**
 * One page for one word, reached as `/study/?w=1:2:3`.
 *
 * The word is a query rather than a path segment because the site is exported
 * as static files and there are 77,430 words in the muṣḥaf — a route parameter
 * would mean prerendering 77,430 pages to serve one of them. A query costs one
 * page and reads the same in the address bar.
 *
 * `useSearchParams` suspends on a statically rendered page, so the boundary is
 * required rather than decorative: without it the export fails.
 */
export default function StudyPage() {
  return (
    <Suspense fallback={null}>
      <WordStudy />
    </Suspense>
  );
}
