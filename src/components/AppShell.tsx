"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "./SiteHeader";
import { SearchOverlay } from "./search/SearchOverlay";
import { Transport } from "./Transport";
import { PlanKeeper } from "./plan/PlanKeeper";
import { NicheKeeper } from "./niche/NicheKeeper";
import { useT } from "@/lib/i18n";
import styles from "./AppShell.module.css";

/**
 * The frame every screen sits in: a fixed header, one scrolling region, and the
 * two things that float above both — the search overlay and the transport.
 *
 * The page itself does not scroll; the region inside it does. That is what lets
 * the reader keep a side panel pinned beside the text without the two fighting
 * over the same scrollbar.
 *
 * The ground under all of it is the page's own, except on the landing page,
 * which is lit from a lamp above the top edge and carries the dark it needs
 * here — on the frame rather than inside the page, so the gradient stays put
 * against the viewport while the page scrolls through it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const onHome = path === "/";
  // A film is watched with nothing round it: no header over the sky, and no
  // second transport under the film's own.
  const parts = path.split("/").filter(Boolean);
  const watching = parts[0] === "read" && parts[2] === "horizons";
  const t = useT();

  return (
    <div className={`${styles.shell} ${onHome ? styles.shellHome : ""}`}>
      <a href="#main" className="skip-link">
        {t("shell.skip")}
      </a>
      {!watching && <SiteHeader />}
      <main id="main" className={styles.main}>
        {children}
      </main>
      {!watching && <Transport />}
      <SearchOverlay />
      {/* The plan speaks last, so that when both have something to say at
          once — a portion and a juzʾ finished together — the plan is heard. */}
      <NicheKeeper />
      <PlanKeeper />
    </div>
  );
}
