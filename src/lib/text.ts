import { SURAH_NAMES } from "./quran/surahNames";
import type { Para } from "./quran/types";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** 255 → ٢٥٥. Used for the ayah discs, which are set in Arabic numerals. */
export function arabicNumber(n: number | string): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[+d]);
}

/** "87th" in English; elsewhere the number, which the sentence around it carries. */
export function ordinal(n: number, locale: string): string {
  if (locale !== "en") return String(n);
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
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
 * Somebody else's markup, parsed where it can do nothing.
 *
 * A translation or a tafsir is text from another server, and the way to read
 * the words out of its markup is to let the browser parse it. Parsing it into
 * an element of *this* page — `div.innerHTML = html`, even on a div that is
 * never put on the screen — is not reading it: the browser starts fetching its
 * images at once and runs their `onerror` when they fail, so one
 * `<img src=x onerror=…>` in a translation would be a script running on this
 * site, with the reader's notes and bookmarks in its reach. Nothing the corpus
 * sends today does that. A page should not depend on it.
 *
 * `DOMParser` builds a document of its own that has no window: nothing in it
 * is fetched, no handler in it can run, and the words are read off it just the
 * same. Null where there is no browser, and the callers fall back to reading
 * the string.
 */
function inert(html: string): HTMLElement | null {
  if (typeof DOMParser === "undefined") return null;
  try {
    return new DOMParser().parseFromString(html, "text/html").body;
  } catch {
    return null;
  }
}

/**
 * Strip the markup a translation or tafsir arrives wrapped in and collapse the
 * whitespace, so it can be set as plain text. Translations carry footnote
 * `<sup>` markers that would otherwise read as stray digits mid-sentence.
 */
export function plainText(html: string | null | undefined): string {
  if (!html) return "";
  const el = inert(html);
  if (el) {
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

  const el = inert(html);
  if (el) {
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

/**
 * Whether this names an ayah there is: `2:255`, and not `2:999`, `0:0` or
 * `002:255`.
 *
 * It used to ask only whether the key was two numbers with a colon between
 * them, and every page that takes an ayah from its address believed it — so
 * `/ayah/?v=2:999` opened a study of "Al-Baqarah 2:999" with nothing in it,
 * and a note file edited by hand could put a bookmark on a surah 999 whose
 * link went nowhere. The key must also be written the one way the site writes
 * it, since it is used as it stands to look things up.
 */
export function isValidVerseKey(key: string): boolean {
  const m = /^([1-9]\d{0,2}):([1-9]\d{0,2})$/.exec(key);
  if (!m) return false;
  const surah = SURAH_NAMES[Number(m[1]) - 1];
  return !!surah && Number(m[2]) <= surah.ayat;
}

/** Minutes and seconds, and the hour too once there is one — a surah read
 *  whole runs past the hour long before al-Baqarah. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = Math.floor(seconds % 60);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
