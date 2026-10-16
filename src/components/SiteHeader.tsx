"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useSearch } from "./search/SearchProvider";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSettings, type Theme } from "@/lib/store/settings";
import styles from "./SiteHeader.module.css";

/** The three reading lights, in the order the day runs. */
const LIGHTS: { id: Theme; title: MessageKey; icon: React.ReactNode }[] = [
  {
    id: "day",
    title: "light.day",
    icon: (
      <>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
      </>
    ),
  },
  {
    id: "evening",
    title: "light.evening",
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
    title: "light.night",
    icon: <path d="M20 14.4A8.2 8.2 0 1 1 9.6 4a6.6 6.6 0 0 0 10.4 10.4z" />,
  },
];

/** Where the site goes, each with what is drawn in its niche above its name. */
const NAV: { href: string; label: MessageKey; match: (p: string) => boolean; icon: React.ReactNode }[] = [
  {
    href: "/surahs/",
    label: "nav.surahs",
    match: (p) => p.startsWith("/surahs"),
    // The muṣḥaf, open on its stand.
    icon: (
      <>
        <path d="M12 6.6C10.2 5.3 7.6 4.7 4.5 4.9v10.6c3.1-.2 5.7.4 7.5 1.7 1.8-1.3 4.4-1.9 7.5-1.7V4.9c-3.1-.2-5.7.4-7.5 1.7z" />
        <path d="M12 6.6v10.6M8 20.6l8-3.4M16 20.6l-8-3.4" />
      </>
    ),
  },
  {
    href: "/plan/",
    label: "nav.plan",
    match: (p) => p.startsWith("/plan"),
    // A reading through, most of the way round.
    icon: (
      <>
        <circle cx="12" cy="12" r="8" opacity="0.35" />
        <path d="M12 4a8 8 0 1 1-7.7 10.1" />
        <circle cx="12" cy="4" r="1.1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    href: "/tafsir/",
    label: "nav.tafsir",
    match: (p) => p.startsWith("/tafsir"),
    // The shelf: volumes standing, one leaning.
    icon: (
      <>
        <path d="M4.2 4.6h3.6v14.6H4.2zM9 4.6h3.6v14.6H9zM14 6.1l3.5-.9 3.5 13.7-3.5.9z" />
        <path d="M4.2 8.2h3.6M9 8.2h3.6M3 19.8h18" />
      </>
    ),
  },
  {
    href: "/notes/",
    label: "nav.notes",
    match: (p) => p.startsWith("/notes"),
    // A pen at the end of a line.
    icon: (
      <>
        <path d="M5 18.4l1-4.1L15.7 4.6a2 2 0 0 1 2.9 2.9L8.9 17.2z" />
        <path d="M14.1 6.3l2.9 2.9M12.5 19.6H20" />
      </>
    ),
  },
  {
    href: "/bookmarks/",
    label: "nav.bookmarks",
    match: (p) => p.startsWith("/bookmarks"),
    icon: <path d="M7 3.6h10v16.8l-5-3.8-5 3.8z" />,
  },
  {
    href: "/settings/",
    label: "nav.settings",
    match: (p) => p.startsWith("/settings"),
    icon: (
      <>
        <path d="M4 7.5h8M16.4 7.5H20M4 16.5h2.6M11 16.5h9" />
        <circle cx="14.2" cy="7.5" r="2.2" />
        <circle cx="8.8" cy="16.5" r="2.2" />
      </>
    ),
  },
];

/**
 * A niche, drawn in a box 100 wide and 120 high: a two-centred arch, each half
 * an arc about a point on the line it springs from, so it comes to the slight
 * point a miḥrāb does; and a second line inside it, as the niche is cut back.
 */
const NICHE_OUTER = "M1 119V61A60 60 0 0 1 50 2.02A60 60 0 0 1 99 61V119Z";
const NICHE_INNER = "M7 113V61A54 54 0 0 1 50 8.13A54 54 0 0 1 93 61V113Z";
/** The mosque lamp of the reader's niche (NicheScene's `lampPath`), small, hung from the inner arch. */
const NICHE_LAMP =
  "M45.8 18.1H54.2Q52.6 20.7 52.4 23.4C56.6 24.7 57 29.5 53.1 31.3L52 32.8H48L46.9 31.3C43 29.5 43.4 24.7 47.6 23.4Q47.4 20.7 45.8 18.1Z";

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const { openSearch } = useSearch();
  const { settings, update } = useSettings();
  const { t, arabicScript } = useLocale();

  // The landing page is read against a lit niche rather than paper, so the bar
  // gives up its own ground there and sits in the light: no fill, no rule under
  // it, pale ink, the light gold rather than the filled one. Everything else in
  // the site is a page, and the bar is the page's own colour.
  const onHome = pathname === "/";

  // The six places are kept in a menu that drops from the bar, at every width.
  // Laid out as a row of niches they are a map of the site rather than a line
  // of words squeezed in beside everything else, and the bar is left holding
  // only what a reader reaches for while reading: the light and the search.
  //
  // The menu is open on the page it was opened on, and only there: arriving
  // anywhere else — by one of its own niches, the back button, a link in the
  // page — closes it, with nothing to remember to reset.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const menuOpen = openAt === pathname;
  const closeMenu = () => setOpenAt(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const glowId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenAt(null);
      menuButton.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header
      className={`${styles.header} ${onHome ? styles.headerHome : ""} ${menuOpen ? styles.headerOpen : ""}`}
    >
      <Link href="/" className={styles.brand} onClick={closeMenu}>
        <span className={styles.brandArabic}>مشكاة</span>
        {/* The name in Latin letters is a transliteration of the word beside
            it. A reader of an Arabic script has just read the word itself. */}
        {!arabicScript && <span className={styles.brandName}>{t("brand.name")}</span>}
        <span className={styles.brandKicker}>{t("brand.kicker")}</span>
      </Link>

      <div className={styles.lights} role="group" aria-label={t("light.group")}>
        {LIGHTS.map((light) => {
          const on = settings.theme === light.id;
          return (
            <button
              key={light.id}
              onClick={() => update({ theme: light.id })}
              aria-pressed={on}
              title={t(light.title)}
              aria-label={t(light.title)}
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
        onClick={() => {
          closeMenu();
          openSearch();
        }}
        className={`btn btn-secondary ${styles.search}`}
        aria-label={t("nav.searchLabel")}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className={styles.searchLabel}>{t("nav.search")}</span>
        <kbd className={styles.kbd}>/</kbd>
      </button>

      <button
        ref={menuButton}
        onClick={() => setOpenAt(menuOpen ? null : pathname)}
        className={`btn btn-secondary ${styles.menuButton}`}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={t("nav.menu")}
      >
        <span className={styles.menuGlyph} aria-hidden="true">
          <span />
          <span />
        </span>
        <span className={styles.menuLabel}>{t("nav.menu")}</span>
      </button>

      {/* The page under an open menu is dimmed and out of reach, and a tap on
          it is a way out. */}
      <div className={styles.scrim} data-open={menuOpen || undefined} onClick={closeMenu} aria-hidden="true" />

      {/* Each place is a niche, and the one the reader is in has its lamp lit.
          Kept in the page while closed, and inert, so it can open and close
          as a movement rather than appear. */}
      <nav
        id={menuId}
        className={styles.sheet}
        data-open={menuOpen || undefined}
        inert={!menuOpen}
        aria-label={t("nav.primary")}
      >
        <svg className={styles.defs} aria-hidden="true">
          <radialGradient id={glowId} cx="50%" cy="18%" r="80%">
            <stop offset="0" className={styles.glowNear} />
            <stop offset="0.55" className={styles.glowMid} />
            <stop offset="1" className={styles.glowFar} />
          </radialGradient>
        </svg>
        <ul className={styles.niches}>
          {NAV.map((item) => {
            const current = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeMenu}
                  aria-current={current ? "page" : undefined}
                  className={`${styles.niche} ${current ? styles.nicheOn : ""}`}
                >
                  <svg className={styles.nicheFrame} viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true">
                    <path className={styles.nicheInner} d={NICHE_INNER} fill={current ? `url(#${glowId})` : "none"} />
                    <path className={styles.nicheOuter} d={NICHE_OUTER} />
                    {current && (
                      <>
                        <path className={styles.nicheChain} d="M50 8.4V18.1" />
                        <path className={styles.nicheLamp} d={NICHE_LAMP} />
                      </>
                    )}
                  </svg>
                  <svg
                    className={styles.nicheIcon}
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </svg>
                  <span className={styles.nicheLabel}>{t(item.label)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
