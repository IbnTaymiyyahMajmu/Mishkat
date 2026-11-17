import type { Metadata } from "next";
import { Suspense } from "react";
import { PageView } from "@/components/mushaf/PageView";

export const metadata: Metadata = {
  title: "The muṣḥaf, page by page",
  description:
    "The Madīnah muṣḥaf as it is printed: its 604 pages, fifteen lines to a page, every word on the line it is printed on — found by surah, by juzʾ and ḥizb, or by the number of the page.",
};

/**
 * The muṣḥaf by its pages: `/mushaf/?p=42`, or `/mushaf/?v=2:255` for the page
 * an ayah is on. With neither, it opens where the reader last was.
 *
 * The page is a query rather than a path for the reason the ayah study gives:
 * the site is exported as static files, and 604 pages of one screen each are
 * one screen. `useSearchParams` suspends on a statically rendered page, so the
 * boundary is required rather than decorative.
 */
export default function MushafPages() {
  return (
    <Suspense fallback={null}>
      <PageView />
    </Suspense>
  );
}
