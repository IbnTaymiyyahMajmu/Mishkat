"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

/** In a component of its own so that it can be said in the reader's language. */
export function NotFoundPage() {
  const t = useT();
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "60px 24px", textAlign: "center" }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-amiri-quran), serif",
            fontSize: 30,
            color: "color-mix(in srgb, var(--color-accent) 55%, transparent)",
          }}
        >
          ۞
        </div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 32, margin: "14px 0 8px" }}>
          {t("notFound.title")}
        </h1>
        <p style={{ color: "var(--muted-55)", fontSize: 14, maxWidth: "40ch", margin: "0 auto 20px" }}>
          {t("notFound.body")}
        </p>
        <Link href="/surahs/" className="btn btn-primary">
          {t("notFound.action")}
        </Link>
      </div>
    </div>
  );
}
