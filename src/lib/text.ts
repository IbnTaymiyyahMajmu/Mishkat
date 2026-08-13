import type { Para } from "./quran/types";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** 255 → ٢٥٥. Used for the ayah discs, which are set in Arabic numerals. */
export function arabicNumber(n: number | string): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[+d]);
}

const ARABIC_RANGE = /[؀-ۿ]/;

/** Whether a passage should be laid out right-to-left. */
export function isMostlyArabic(text: string): boolean {
  const arabic = (text.match(/[؀-ۿ]/g) || []).length;
  return arabic > text.length * 0.35;
}

export function hasArabic(text: string): boolean {
  return ARABIC_RANGE.test(text);
}

/**
 * Strip the markup a translation or tafsir arrives wrapped in and collapse the
 * whitespace, so it can be set as plain text. Translations carry footnote
 * `<sup>` markers that would otherwise read as stray digits mid-sentence.
 */
export function plainText(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    el.querySelectorAll("sup").forEach((s) => s.remove());
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tafsir and chapter introductions arrive as a single blob of HTML. Split it
 * back into paragraphs, keeping which ones are headings and which are Arabic,
 * so each can be set in the face and direction it belongs in — rather than
 * dumping the whole work in one direction and one size.
 */
export function htmlToParas(html: string | null | undefined): Para[] {
  if (!html) return [];
  const out: Para[] = [];

  const push = (raw: string, heading: boolean) => {
    const text = plainText(raw);
    if (!text) return;
    out.push({ text, heading, rtl: isMostlyArabic(text) });
  };

  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    el.querySelectorAll("h1,h2,h3,h4,p,li,blockquote").forEach((node) => {
      push(node.innerHTML, /^H[1-4]$/.test(node.tagName));
    });
  } else {
    const re = /<(h[1-4]|p|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) push(m[2], /^h[1-4]$/i.test(m[1]));
  }

  if (!out.length) push(html, false);
  return out;
}

/**
 * Strip the diacritics that separate one spelling of a word from another, so a
 * word can be looked up elsewhere in the muṣḥaf by its bare form.
 */
export function stripDiacritics(text: string): string {
  return text.replace(/[ً-ٰٟۖ-ۭ]/g, "");
}

export function verseKeyParts(key: string): { surah: number; ayah: number } {
  const [s, a] = key.split(":");
  return { surah: +s, ayah: +a };
}

export function isValidVerseKey(key: string): boolean {
  return /^\d{1,3}:\d{1,3}$/.test(key);
}

/** "12 August 2026" in the reader's own locale. */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
