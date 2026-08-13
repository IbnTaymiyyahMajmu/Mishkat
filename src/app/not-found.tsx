import Link from "next/link";

export default function NotFound() {
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
          There is no page here
        </h1>
        <p style={{ color: "var(--muted-55)", fontSize: 14, maxWidth: "40ch", margin: "0 auto 20px" }}>
          The surahs run from 1 to 114. Try the index, or search for a reference like 2:255.
        </p>
        <Link href="/surahs/" className="btn btn-primary">
          Browse all 114 surahs
        </Link>
      </div>
    </div>
  );
}
