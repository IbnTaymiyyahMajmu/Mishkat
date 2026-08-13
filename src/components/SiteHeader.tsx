"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSearch } from "./search/SearchProvider";
import { useSettings } from "@/lib/store/settings";
import styles from "./SiteHeader.module.css";

const NAV = [
  { href: "/read/", label: "Read", match: (p: string) => p.startsWith("/read") },
  { href: "/surahs/", label: "Surahs", match: (p: string) => p.startsWith("/surahs") },
  { href: "/notes/", label: "Notes", match: (p: string) => p.startsWith("/notes") },
  { href: "/bookmarks/", label: "Bookmarks", match: (p: string) => p.startsWith("/bookmarks") },
  { href: "/settings/", label: "Settings", match: (p: string) => p.startsWith("/settings") },
];

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const { openSearch } = useSearch();
  const { lastRead } = useSettings();

  // "Read" resumes where the reader stopped rather than always opening al-Fātiḥah.
  const readHref = lastRead
    ? `/read/${lastRead.surah}/${lastRead.verseKey ? `#${lastRead.verseKey}` : ""}`
    : "/read/1/";

  // The landing page is read against a lit niche rather than paper, so the bar
  // gives up its own ground there and sits in the light: no fill, no rule under
  // it, pale ink, the light gold rather than the filled one. Everything else in
  // the site is a page, and the bar is the page's own colour.
  const onHome = pathname === "/";

  return (
    <header className={`${styles.header} ${onHome ? styles.headerHome : ""}`}>
      <Link href="/" className={styles.brand}>
        <span className={styles.brandArabic}>مشكاة</span>
        <span className={styles.brandName}>Mishkāt</span>
        <span className={styles.brandKicker}>Qur&rsquo;an</span>
      </Link>

      <nav className={styles.nav} aria-label="Primary">
        {NAV.map((item) => {
          const current = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href === "/read/" ? readHref : item.href}
              aria-current={current ? "page" : undefined}
              className={`${styles.navLink} ${current ? styles.navLinkOn : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => openSearch()}
        className={`btn btn-secondary ${styles.search}`}
        aria-label="Search the Qur'an"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className={styles.searchLabel}>Search</span>
        <kbd className={styles.kbd}>/</kbd>
      </button>
    </header>
  );
}
