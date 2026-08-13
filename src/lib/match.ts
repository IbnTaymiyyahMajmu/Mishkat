/**
 * Matching that ignores how a word happens to be spelled.
 *
 * A reader who types `الرحمن` means the word, not that exact sequence of code
 * points: the muṣḥaf writes it `ٱلرَّحْمَـٰن`, with a waṣla, a shadda, a sukūn and a
 * superscript alif that nobody types. The same is true of `Baqarah` against
 * `Baqarah`'s accented forms. So both sides are folded to a bare form before
 * they are compared.
 *
 * Folding also has to be reversible enough to *highlight* the match, which is
 * why this keeps an index map rather than just returning a string: the match is
 * found in the folded text and then painted onto the original, so the reader
 * sees their term lit up inside fully-pointed Qur'anic text.
 */

export interface Folded {
  /** The folded text — one character per kept character of `source`. */
  text: string;
  /** `map[i]` is the index in `source` of folded character `i`. */
  map: number[];
  /** The NFD-normalised original that `map` indexes into. */
  source: string;
}

/** Marks that change the spelling but not the word. */
function isDroppable(code: number): boolean {
  return (
    (code >= 0x0300 && code <= 0x036f) || // Latin combining marks
    (code >= 0x064b && code <= 0x065f) || // Arabic tashkīl
    code === 0x0670 || // superscript alif
    (code >= 0x06d6 && code <= 0x06ed) || // Qur'anic annotation marks
    code === 0x0640 // taṭwīl, a stretch of the baseline and nothing more
  );
}

/** Letters that differ only by a hamza seat or a final form. */
const UNIFY: Record<string, string> = {
  "آ": "ا", // آ → ا
  "أ": "ا", // أ → ا
  "إ": "ا", // إ → ا
  "ٱ": "ا", // ٱ → ا
  "ى": "ي", // ى → ي
  "ة": "ه", // ة → ه
};

export function fold(input: string | null | undefined): Folded {
  const source = String(input ?? "").normalize("NFD");
  let text = "";
  const map: number[] = [];

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (isDroppable(ch.charCodeAt(0))) continue;
    const lower = ch.toLowerCase();
    text += UNIFY[lower] ?? lower;
    map.push(i);
  }

  return { text, map, source };
}

/** Convenience for the common case of only wanting the comparable string. */
export function foldToText(input: string | null | undefined): string {
  return fold(input).text;
}

export interface MatchPart {
  text: string;
  /** Whether this run is part of the reader's term. */
  hit: boolean;
}

/**
 * Split `text` into runs, marking the ones matching `needle`. `needle` must
 * already be folded — it is compared against folded text, and the caller
 * generally folds the query once and reuses it across every result.
 *
 * Returns a single unmarked run when there is nothing to mark, so the caller
 * can render the same way in both cases.
 */
export function markMatches(text: string, needle: string): MatchPart[] {
  const whole: MatchPart[] = [{ text: String(text ?? ""), hit: false }];
  if (!needle || needle.length < 2) return whole;

  const folded = fold(text);
  const parts: MatchPart[] = [];
  let taken = 0;
  let from = 0;

  for (;;) {
    const at = folded.text.indexOf(needle, from);
    if (at < 0) break;
    // Back out to the original string: the first kept character of the match,
    // and one past the last.
    const start = folded.map[at];
    const end = folded.map[at + needle.length - 1] + 1;
    if (start > taken) parts.push({ text: folded.source.slice(taken, start), hit: false });
    parts.push({ text: folded.source.slice(start, end), hit: true });
    taken = end;
    from = at + needle.length;
  }

  if (!parts.length) return whole;
  if (taken < folded.source.length) {
    parts.push({ text: folded.source.slice(taken), hit: false });
  }
  return parts;
}
