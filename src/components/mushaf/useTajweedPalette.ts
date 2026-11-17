"use client";

import { useEffect, useSyncExternalStore, type RefObject } from "react";
import type { Family } from "@/lib/quran/tajweed";

/**
 * The tajweed pages, in this site's colours.
 *
 * The King Fahd Complex's tajweed pages carry their colours inside the font:
 * every letter a rule falls on is drawn in a colour from a table of sixteen,
 * the same table in all 604 fonts. Left as they are, the pages would teach a
 * second key — their gold is not this site's gold, and their ink is pure
 * white or pure black on any ground. So each entry of the table is given the
 * colour this site gives the same thing (`--tj-*` in globals.css), read from
 * the page as it is lit, and given again whenever the light changes.
 *
 * What each entry stands for was read off the fonts' own table and checked
 * against the corpus's markings of a page, letter by letter:
 *
 *    0 13 14   the ink
 *    1 15      what is written and not said: hamzat al-waṣl, the silent alif,
 *              the lām of the sun letters
 *    2         a letter merged into the next without the nose
 *    3         held six counts, by necessity
 *    4         held two, four or six, as the reader chooses
 *    5         held two, the natural length
 *    6         through the nose: ghunnah, ikhfāʾ, iqlāb, merging with it
 *    7         a heavy letter (tafkhīm) — which this site's key does not
 *              mark, and which is set in the ink so the page and the key agree
 *    8         the bounce: qalqalah
 *    9         held four or five
 *    10 11     the lines of the mark that closes an ayah
 *    12        the ground inside that mark
 *
 * With some families picked out in the legend, the others are set in the ink,
 * as they are in the reader.
 */

type Part = "ink" | "silent" | "merge" | "madd6" | "madd246" | "madd2" | "nasal" | "bounce" | "madd45" | "mark" | "markGround";

const ENTRIES: Part[] = [
  "ink", "silent", "merge", "madd6", "madd246", "madd2", "nasal", "ink",
  "bounce", "madd45", "mark", "mark", "markGround", "ink", "ink", "silent",
];

const FAMILY: Partial<Record<Part, Family>> = {
  silent: "silent",
  merge: "merge",
  madd6: "hold",
  madd246: "hold",
  madd2: "hold",
  madd45: "hold",
  nasal: "nasal",
  bounce: "bounce",
};

const SOURCE: Record<Part, string> = {
  ink: "var(--color-text)",
  silent: "var(--tj-silent)",
  merge: "var(--tj-merge)",
  madd6: "var(--tj-madd6)",
  madd246: "var(--tj-madd246)",
  madd2: "var(--tj-madd2)",
  nasal: "var(--tj-nasal)",
  bounce: "var(--tj-bounce)",
  madd45: "var(--tj-madd45)",
  mark: "var(--color-accent)",
  markGround: "var(--color-bg)",
};

export const PALETTE = "--mk-tajweed";

/** The light the page is in, kept up to date: it decides every colour. */
function watchLight(onChange: () => void) {
  const watching = new MutationObserver(onChange);
  watching.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => watching.disconnect();
}
const lightNow = () => document.documentElement.dataset.theme ?? "evening";
const noLight = () => "";

/**
 * Writes the palette for the page's tajweed font while one is shown.
 * `within` is where the colours are read: an element inside the page, so
 * that what it inherits is what the page has. Until the palette is written
 * the page is drawn in the font's own colours, for a frame.
 */
export function useTajweedPalette(family: string | null, focus: Family[], within: RefObject<HTMLElement | null>): void {
  const light = useSyncExternalStore(watchLight, lightNow, noLight);
  const focusKey = focus.join(",");

  useEffect(() => {
    const host = within.current;
    if (!family || !host || !light) return;
    const probe = document.createElement("span");
    probe.style.display = "none";
    host.appendChild(probe);
    const colour = (source: string) => {
      probe.style.color = source;
      return getComputedStyle(probe).color;
    };
    const ink = colour(SOURCE.ink);
    const chosen = focusKey ? new Set(focusKey.split(",")) : null;
    const overrides = ENTRIES.map((part, i) => {
      const family = FAMILY[part];
      const shown = !family || !chosen || chosen.has(family);
      return `${i} ${shown ? colour(SOURCE[part]) : ink}`;
    });
    probe.remove();

    const paper = light === "day" || light === "dawn";
    const style = document.createElement("style");
    style.setAttribute("data-mishkat-tajweed-palette", "");
    style.textContent = `@font-palette-values ${PALETTE} { font-family: "${family}"; base-palette: ${paper ? 0 : 1}; override-colors: ${overrides.join(", ")}; }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [family, focusKey, light, within]);
}
