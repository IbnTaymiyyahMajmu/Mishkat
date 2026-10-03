import type { Metadata } from "next";
import { Suspense } from "react";
import { TafsirPage } from "@/components/tafsir/TafsirPage";

export const metadata: Metadata = {
  title: "Tafsir",
  description:
    "The tafsir of one ayah of the Qur'an, read at length: the classical works in Arabic and the shorter ones in English, each under its own author, side by side.",
};

/**
 * One page for the tafsir of any ayah, reached as `/tafsir/?v=2:255`.
 *
 * The ayah is a query rather than a path segment for the reason the word study
 * page gives: the site is exported as static files, and a route parameter
 * would mean prerendering 6,236 pages to serve one of them.
 *
 * `useSearchParams` suspends on a statically rendered page, so the boundary is
 * required rather than decorative: without it the export fails.
 */
export default function Tafsir() {
  return (
    <Suspense fallback={null}>
      <TafsirPage />
    </Suspense>
  );
}
