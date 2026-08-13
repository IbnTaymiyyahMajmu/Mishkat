import type { WordHighlight } from "./store/settings";

/**
 * Word highlighting, painted straight onto the document.
 *
 * A long surah is thousands of word nodes. Driving the highlight through React
 * state means re-rendering that tree on every mouse move and on every audio
 * frame, which costs most of a second per hover on al-Baqarah. Instead four
 * CSS rules are inserted once and only their *selectors* are rewritten, so the
 * sheet is never torn down, the transitions keep running, and React never hears
 * about a hover at all.
 *
 * Two sources feed it, and both can be lit at once: the pointer (or keyboard
 * focus), and the word currently being recited.
 */

const ACCENT = "var(--color-accent)";
const TINT = "var(--tint)";
const NONE = '[data-w="__none__"]';

const ROLE_COLOR: Record<string, string> = {
  ar: "var(--color-accent-800)",
  tr: "var(--color-accent-700)",
  en: "var(--color-accent-700)",
};

class HighlightPainter {
  private sheet: CSSStyleSheet | null = null;
  private rules: CSSStyleRule[] = [];
  private el: HTMLStyleElement | null = null;
  private hoverId: string | null = null;
  private reciteId: string | null = null;
  private style: WordHighlight = "both";
  private users = 0;

  /** Mounts the sheet on first use and reference-counts it. */
  acquire(): () => void {
    this.users += 1;
    if (this.users === 1) this.mount();
    return () => {
      this.users -= 1;
      if (this.users === 0) this.unmount();
    };
  }

  private mount() {
    if (typeof document === "undefined" || this.el) return;
    const el = document.createElement("style");
    el.setAttribute("data-mishkat-highlight", "");
    document.head.appendChild(el);
    this.el = el;
    const sheet = el.sheet;
    if (!sheet) return;
    this.sheet = sheet;
    sheet.insertRule(`${NONE}{background:${TINT};border-bottom-color:${ACCENT}}`, 0);
    (["ar", "tr", "en"] as const).forEach((role, i) => {
      sheet.insertRule(`${NONE}{color:${ROLE_COLOR[role]}}`, i + 1);
    });
    this.rules = Array.from(sheet.cssRules) as CSSStyleRule[];
    this.paint();
  }

  private unmount() {
    this.el?.remove();
    this.el = null;
    this.sheet = null;
    this.rules = [];
    this.hoverId = null;
    this.reciteId = null;
  }

  setHover(id: string | null) {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.paint();
  }

  setRecite(id: string | null) {
    if (id === this.reciteId) return;
    this.reciteId = id;
    this.paint();
  }

  setStyle(style: WordHighlight) {
    if (style === this.style) return;
    this.style = style;
    this.paint();
  }

  get hovered(): string | null {
    return this.hoverId;
  }

  private paint() {
    const rules = this.rules;
    if (rules.length < 4) return;
    const ids = [this.hoverId, this.reciteId].filter(Boolean) as string[];
    const base = ids.length ? ids.map((id) => `[data-w="${cssEscape(id)}"]`) : [NONE];

    rules[0].style.setProperty("background", this.style === "underline" ? "transparent" : TINT);
    rules[0].style.setProperty(
      "border-bottom-color",
      this.style === "tint" ? "transparent" : ACCENT,
    );
    rules[0].selectorText = base.join(",");

    (["ar", "tr", "en"] as const).forEach((role, i) => {
      rules[i + 1].selectorText = base.map((s) => `${s}[data-role="${role}"]`).join(",");
    });
  }
}

/** Verse keys contain a colon, which is legal in an attribute-value selector. */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

export const highlight = new HighlightPainter();

/** `"2:255:3"` — the address of one word on screen. */
export function wordDomId(verseKey: string, position: number): string {
  return `${verseKey}:${position}`;
}

export function parseWordDomId(id: string): { verseKey: string; position: number } | null {
  const parts = id.split(":");
  if (parts.length !== 3) return null;
  const position = Number(parts[2]);
  if (!Number.isFinite(position)) return null;
  return { verseKey: `${parts[0]}:${parts[1]}`, position };
}
