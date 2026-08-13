import type { Note, NoteQuote } from "./store/types";
import type { Verse } from "./quran/types";
import { plainText } from "./text";

/**
 * A note is plain text with quote markers in it.
 *
 * `{{2:255}}` on a line of its own stands for a quoted ayah. Keeping the marker
 * inline — rather than attaching quotes to the top of the note — means the
 * writer can put their own words before, between and after the ayat they are
 * responding to, which is how anyone actually takes notes on a text.
 *
 * The quoted text itself lives in `note.quotes`, snapshotted at the moment of
 * quoting, so a note reads the same after the reader switches translation and
 * reads at all on a plane.
 */

export const QUOTE_PATTERN = /\{\{(\d{1,3}:\d{1,3})\}\}/g;

export type NoteSegment =
  | { kind: "text"; text: string }
  | { kind: "quote"; verseKey: string; quote: NoteQuote | null };

export function quoteToken(verseKey: string): string {
  return `{{${verseKey}}}`;
}

/** Split a note body into the pieces a renderer needs, in order. */
export function parseNoteBody(body: string, quotes: NoteQuote[]): NoteSegment[] {
  const byKey = new Map(quotes.map((q) => [q.verseKey, q]));
  const out: NoteSegment[] = [];
  let last = 0;

  for (const match of body.matchAll(QUOTE_PATTERN)) {
    const at = match.index ?? 0;
    if (at > last) pushText(out, body.slice(last, at));
    out.push({ kind: "quote", verseKey: match[1], quote: byKey.get(match[1]) ?? null });
    last = at + match[0].length;
  }
  if (last < body.length) pushText(out, body.slice(last));
  return out;
}

function pushText(out: NoteSegment[], raw: string) {
  const text = raw.replace(/^\n+|\n+$/g, "");
  if (text.trim()) out.push({ kind: "text", text });
}

/** Which ayat a note quotes, in the order they appear in it. */
export function quotedKeys(body: string): string[] {
  return [...body.matchAll(QUOTE_PATTERN)].map((m) => m[1]);
}

/**
 * Insert a quote at the caret, on its own line, and return the new body along
 * with where the caret should end up — after the quote, ready to write about it.
 */
export function insertQuote(
  body: string,
  caret: number,
  verseKey: string,
): { body: string; caret: number } {
  const token = quoteToken(verseKey);
  const before = body.slice(0, caret);
  const after = body.slice(caret);
  const lead = before && !before.endsWith("\n") ? "\n\n" : "";
  const trail = after.startsWith("\n") ? "\n" : "\n\n";
  const insert = `${lead}${token}${trail}`;
  return { body: before + insert + after, caret: (before + insert).length };
}

/** Build the snapshot stored alongside a note when an ayah is quoted. */
export function quoteFromVerse(verse: Verse, fallbackTranslator: string): NoteQuote {
  const translation = verse.translations?.[0];
  return {
    verseKey: verse.verse_key,
    arabic: verse.text_uthmani,
    translation: plainText(translation?.text),
    translator: translation?.resource_name || fallbackTranslator,
  };
}

/** Drop snapshots for quotes the writer has deleted from the body. */
export function pruneQuotes(body: string, quotes: NoteQuote[]): NoteQuote[] {
  const keep = new Set(quotedKeys(body));
  return quotes.filter((q) => keep.has(q.verseKey));
}

/** A one-line summary for a note that was never given a title. */
export function noteHeadline(note: Note): string {
  if (note.title.trim()) return note.title.trim();
  const firstText = parseNoteBody(note.body, note.quotes).find((s) => s.kind === "text");
  if (firstText && firstText.kind === "text") {
    const line = firstText.text.trim().split("\n")[0];
    return line.length > 72 ? `${line.slice(0, 71)}…` : line;
  }
  return note.verseKey ? `Note on ${note.verseKey}` : `Note on surah ${note.surah}`;
}

export function noteMatches(note: Note, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (note.title.toLowerCase().includes(q)) return true;
  if (note.body.toLowerCase().includes(q)) return true;
  if (note.verseKey?.includes(q)) return true;
  return note.quotes.some(
    (x) => x.translation.toLowerCase().includes(q) || x.arabic.includes(query.trim()),
  );
}
