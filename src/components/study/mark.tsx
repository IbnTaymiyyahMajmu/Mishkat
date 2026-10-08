/**
 * Mark the words at these positions in an ayah. This is counting rather than
 * matching letters, which is why it can be trusted to mark the right word and
 * no other — provided what is counted is words.
 *
 * A space does not quite do that. The muṣḥaf sets some of its signs off on
 * their own: the pause marks (ۛ ۖ ۗ), the ۞ that opens a quarter, the ۩ of a
 * prostration. The corpus does not number those, so a sign standing alone is
 * passed over without being counted. Counting it put the mark one word late
 * for everything after the first pause in the ayah — in 2:2 the word chosen
 * was فِيهِ and the one lit was the ۛ before it.
 *
 * Shared by the study page and the panel beside the text, which both show the
 * ayat a root occurs in with the words that carry it picked out.
 */
const LETTER = /[\u0621-\u064A\u066E-\u06D3]/;

export function markWords(arabic: string, positions: number[], cls: string) {
  const at = new Set(positions);
  let word = 0;
  return arabic.split(/\s+/).map((w, i) => {
    const counted = LETTER.test(w);
    if (counted) word += 1;
    return (
      <span key={i} className={counted && at.has(word) ? cls : undefined}>
        {w}{" "}
      </span>
    );
  });
}
