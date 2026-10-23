/**
 * A surah's score, as `scripts/build-horizons.mjs` writes it to
 * `public/horizons/<n>.json`: for every ayah, which of its words is which sign,
 * from which word the world is veiled, and from which word the camera is told
 * to look. Positions only — the words themselves are the corpus's, and are
 * read from it in the browser like the rest of the text.
 */

export type Region = "mountains" | "dunes" | "harrah" | "coast" | "plains" | "oasis";

/** A sign at a word: `[position, sign]`. A sign ending `!` is that sign without its hour. */
export type Cue = [number, string];

export interface Score {
  v: 1;
  surah: number;
  place: "makkah" | "madinah";
  /** `[from, to, region, title]` — the passages of the surah's introduction, and the land each is set in. */
  passages: [number, number, Region, string][];
  /** One per ayah: `[cues, veiled from (0 = not), look from (0 = not)]`. */
  ayat: [Cue[], number, number][];
}

const HOME = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/horizons`;
const held = new Map<number, Promise<Score | null>>();

export function fetchScore(surah: number): Promise<Score | null> {
  let p = held.get(surah);
  if (!p) {
    p = fetch(`${HOME}/${surah}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Score>) : null))
      .catch(() => null);
    held.set(surah, p);
  }
  return p;
}
