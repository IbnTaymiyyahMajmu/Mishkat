import type { Metadata } from "next";
import { Suspense } from "react";
import { AyahStudy } from "@/components/ulum/AyahStudy";

export const metadata: Metadata = {
  title: "Study an ayah",
  description:
    "One ayah of the Qur'an through its sciences: its words and roots, their forms and grammar, its rhetoric and readings, its occasion, the transmitted reports, the commentators side by side, its rulings, its echoes in the muṣḥaf and its benefits — each from the books of that science.",
};

/**
 * One page for any ayah, studied science by science, reached as
 * `/ayah/?v=2:255`.
 *
 * The ayah is a query rather than a path segment for the reason the word study
 * and the tafsir pages give: the site is exported as static files, and a route
 * parameter would mean prerendering 6,236 pages to serve one of them.
 *
 * `useSearchParams` suspends on a statically rendered page, so the boundary is
 * required rather than decorative: without it the export fails.
 */
export default function AyahStudyPage() {
  return (
    <Suspense fallback={null}>
      <AyahStudy />
    </Suspense>
  );
}
