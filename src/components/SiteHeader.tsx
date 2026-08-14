"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSearch } from "./search/SearchProvider";
import { useSettings, type Theme } from "@/lib/store/settings";
import styles from "./SiteHeader.module.css";

/** The three reading lights, in the order the day runs. */
const LIGHTS: { id: Theme; title: string; icon: React.ReactNode }[] = [
  {
    id: "day",
    title: "Day — bright paper",
    icon: (
      <>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
      </>
    ),
  },
  {
    id: "evening",
    title: "Evening — sepia lamplight",
    icon: (
      <>
        <path d="M3.5 17.5h17" />
        <path d="M7.4 17.5a4.6 4.6 0 0 1 9.2 0" />
        <path d="M12 4.2v2.4M6.4 7.2l1.5 1.5M17.6 7.2l-1.5 1.5" />
      </>
    ),
  },
  {
    id: "night",
    title: "Night — dark ground",
    icon: <path d="M20 14.4A8.2 8.2 0 1 1 9.6 4a6.6 6.6 0 0 0 10.4 10.4z" />,
  },
];

const NAV = [
  { href: "/surahs/", label: "Surahs", match: (p: string) => p.startsWith("/surahs") },
  { href: "/notes/", label: "Notes", match: (p: string) => p.startsWith("/notes") },
  { href: "/bookmarks/", label: "Bookmarks", match: (p: string) => p.startsWith("/bookmarks") },
  { href: "/settings/", label: "Settings", match: (p: string) => p.startsWith("/settings") },
];

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const { openSearch } = useSearch();
  const { settings, update } = useSettings();

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
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`${styles.navLink} ${current ? styles.navLinkOn : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.lights} role="group" aria-label="Reading light">
        {LIGHTS.map((light) => {
          const on = settings.theme === light.id;
          return (
            <button
              key={light.id}
              onClick={() => update({ theme: light.id })}
              aria-pressed={on}
              title={light.title}
              aria-label={light.title}
              className={`${styles.light} ${on ? styles.lightOn : ""}`}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {light.icon}
              </svg>
            </button>
          );
        })}
      </div>

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
