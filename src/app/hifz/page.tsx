import type { Metadata } from "next";
import { Suspense } from "react";
import { HifzPage } from "@/components/hifz/HifzPage";

export const metadata: Metadata = {
  title: "By heart",
  description:
    "Keep the Qur'an by heart: recite an ayah from memory, uncover it a word at a time to check yourself, and have each ayah brought back to you on the day it is due — before it slips.",
};

/**
 * What the reader keeps by heart, and the sittings in which they recite it:
 * `/hifz/`, `/hifz/?review=today`, `/hifz/?s=67&from=1&to=5`.
 *
 * A sitting is a query rather than a path for the reason the ayah study gives:
 * the site is exported as static files, and there is no page to prerender for
 * every passage of the muṣḥaf. `useSearchParams` suspends on a statically
 * rendered page, so the boundary is required rather than decorative.
 */
export default function Hifz() {
  return (
    <Suspense fallback={null}>
      <HifzPage />
    </Suspense>
  );
}
