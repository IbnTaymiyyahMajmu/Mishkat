/**
 * An ayah as the words a reciter says, one after another.
 *
 * The Uthmānī text has more in it than words: the marks of pausing stand
 * between them as though they were words of their own — ۖ ۗ ۚ ۛ — and so do
 * the sign of a prostration and the mark that opens a quarter of a ḥizb. To
 * someone reciting from memory none of those is a word to be uncovered, so
 * each is kept with the word it stands beside: a pause with the word before
 * it, an opening mark with the word after.
 */

const LETTER = /[ء-يٱ-ۓ]/;

export function recitedWords(text: string): string[] {
  const out: string[] = [];
  let opening = "";
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue;
    if (LETTER.test(token)) {
      out.push(opening ? `${opening} ${token}` : token);
      opening = "";
    } else if (out.length) {
      out[out.length - 1] += ` ${token}`;
    } else {
      opening = opening ? `${opening} ${token}` : token;
    }
  }
  return out;
}

/** What rides on a letter: the vowels, the small letters and the signs of recitation. */
const RIDING = /[ً-ٰٟۖ-ۭـ]/;

/**
 * The letter a word opens on, with its vowel, set as it stands at the head of
 * a word — a hint for a reciter who knows the ayah and has lost its thread.
 *
 * A joiner is put after it so that it keeps the shape it has in the word: بـ
 * and not ب. The joiner is spelled out by its number rather than typed, since
 * it cannot be seen in a line of source.
 */
export function firstLetter(word: string): string {
  const chars = [...word];
  const at = chars.findIndex((c) => LETTER.test(c));
  if (at < 0) return "";
  let end = at + 1;
  while (end < chars.length && RIDING.test(chars[end])) end++;
  return chars.slice(at, end).join("") + String.fromCharCode(0x200d);
}
