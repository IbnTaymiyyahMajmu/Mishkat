"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * `/read` on its own resumes where the reader stopped. It cannot redirect at
 * build time, because where they stopped is known only to their browser — so
 * it reads that directly rather than waiting for a store to hydrate and
 * risking a redirect to al-Fātiḥah a frame before the real answer arrives.
 */
export default function ReadIndex() {
  const router = useRouter();

  useEffect(() => {
    let surah = 1;
    let verseKey: string | null = null;
    try {
      const last = JSON.parse(localStorage.getItem("mishkat.last.v1") || "null");
      if (last && Number.isInteger(last.surah)) {
        surah = Math.min(114, Math.max(1, last.surah));
        verseKey = typeof last.verseKey === "string" ? last.verseKey : null;
      }
    } catch {
      /* first visit */
    }
    router.replace(`/read/${surah}/${verseKey ? `#${verseKey}` : ""}`);
  }, [router]);

  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 40 }}>
      <p style={{ fontFamily: "var(--font-heading)", color: "var(--muted-45)" }}>Opening the reader…</p>
    </div>
  );
}
