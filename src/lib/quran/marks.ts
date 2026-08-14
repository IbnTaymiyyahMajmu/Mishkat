import type { Verse } from "./types";

/**
 * What the reader's rail marks on a surah.
 *
 * Almost none of this is a table. The corpus stamps every ayah with the juz it
 * falls in, the rukūʿ it belongs to and whether it carries a sajda, so the
 * divisions of the muṣḥaf are read off the text itself rather than transcribed
 * here and kept in step by hand. That is what makes the rail correct for all
 * one hundred and fourteen surahs without a line of per-surah work: al-Baqarah
 * shows its two juz breaks and forty rukūʿ, al-Kawthar shows none, and neither
 * is a special case.
 *
 * The one genuine table is the named ayat below, which is an editorial list and
 * could not be anything else.
 */

/** Ayat that readers come back to by name rather than by number. */
export const NAMED: Record<string, string> = {
  "2:201": "Rabbanā ātinā — the duʿāʾ",
  "2:255": "Āyat al-Kursī",
  "2:285": "The closing two of al-Baqarah — before sleep",
  "3:190": "The ayat of the night prayer",
  "18:1": "The first ten — for Friday",
  "18:100": "The last ten — for Friday",
  "36:1": "Yā Sīn",
  "55:1": "Al-Raḥmān",
  "59:22": "The closing ayat of al-Ḥashr",
  "67:1": "Al-Mulk — before sleep",
  "112:1": "Al-Ikhlāṣ — the three before sleep",
  "113:1": "Al-Falaq — the three before sleep",
  "114:1": "An-Nās — the three before sleep",
};

/**
 * `sajda` is a place of prostration, `named` one of the ayat above, and `stop`
 * the place the reader themselves last left off.
 */
export type MarkKind = "sajda" | "named" | "stop";

export interface Mark {
  ayah: number;
  kind: MarkKind;
  label: string;
}

export interface JuzBreak {
  /** The juz this ayah opens. */
  n: number;
  ayah: number;
}

export interface Band {
  /** Both inclusive, in ayah numbers. */
  from: number;
  to: number;
}

/**
 * The second prostration of Sūrat al-Ḥajj, which is the one the schools differ
 * over: the Shāfiʿīs hold it a sajda of recitation, the Ḥanafīs do not, and the
 * corpus follows the shorter count — `sajdah_number` is set on fourteen ayat,
 * not fifteen. Marking it and saying whose it is leaves the reader with the
 * disagreement rather than with one school's answer presented as the fact.
 */
const DISPUTED_SAJDA: Record<string, string> = {
  "22:77": "A place of prostration in the Shāfiʿī reckoning",
};

/**
 * Every place of prostration in this surah. The corpus sets `sajdah_number` on
 * exactly the ayah that carries ۩, so this is read off the text rather than
 * transcribed — with the one addition above.
 */
export function sajdaMarks(surah: number, verses: Verse[]): Mark[] {
  const marks: Mark[] = verses
    .filter((v) => v.sajdah_number != null)
    .map((v) => ({
      ayah: v.verse_number,
      kind: "sajda" as const,
      label: "A place of prostration",
    }));

  for (const [key, label] of Object.entries(DISPUTED_SAJDA)) {
    const [s, a] = key.split(":").map(Number);
    if (s === surah && verses.some((v) => v.verse_number === a)) {
      marks.push({ ayah: a, kind: "sajda", label });
    }
  }
  return marks.sort((x, y) => x.ayah - y.ayah);
}

/** The named ayat of this surah, in the order they are read. */
export function namedMarks(surah: number, total: number): Mark[] {
  return Object.entries(NAMED)
    .map(([key, label]) => {
      const [s, a] = key.split(":").map(Number);
      return { surah: s, ayah: a, label };
    })
    .filter((m) => m.surah === surah && m.ayah <= total)
    .map((m) => ({ ayah: m.ayah, kind: "named" as const, label: m.label }));
}

/**
 * Where a reciter is meant to break.
 *
 * A rukūʿ is the muṣḥaf's own paragraph — the ع in the margin closes one — and
 * the end of each is a resting place: somewhere the sense has come to rest and
 * the reader may stop without leaving a sentence hanging. The corpus numbers
 * every ayah's rukūʿ, so a break is simply where that number changes, and the
 * ayah *before* the change is the one to stop on.
 *
 * The last ayah of a surah ends its rukūʿ too, but it is already the end of the
 * rail and does not need marking twice.
 */
export function rukuStops(verses: Verse[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < verses.length - 1; i++) {
    if (verses[i].ruku_number !== verses[i + 1].ruku_number) out.push(verses[i].verse_number);
  }
  return out;
}

/**
 * Juz that begin partway through this surah. A surah that sits inside one juz
 * has none, which is most of them; al-Baqarah has two.
 */
export function juzBreaks(verses: Verse[]): JuzBreak[] {
  const out: JuzBreak[] = [];
  for (let i = 1; i < verses.length; i++) {
    if (verses[i].juz_number !== verses[i - 1].juz_number) {
      out.push({ n: verses[i].juz_number, ayah: verses[i].verse_number });
    }
  }
  return out;
}

/**
 * The stretches of the surah that get the faint gold wash, so each juz reads as
 * a segment with a beginning and an end without needing a second set of ticks.
 * Banded on the parity of the juz number rather than on the order they appear
 * here, so a juz is washed or bare consistently wherever it is met.
 */
export function juzBands(verses: Verse[]): Band[] {
  const out: Band[] = [];
  let run: Band | null = null;
  let runJuz = -1;
  for (const v of verses) {
    if (v.juz_number !== runJuz) {
      if (run && runJuz % 2 === 0) out.push(run);
      runJuz = v.juz_number;
      run = { from: v.verse_number, to: v.verse_number };
    } else if (run) {
      run.to = v.verse_number;
    }
  }
  if (run && runJuz % 2 === 0) out.push(run);
  return out;
}

/**
 * Marks closer together than a button can sit merge into one. A group keeps the
 * true span of its members rather than shouldering its neighbours aside, so no
 * mark is ever drawn away from the ayah it belongs to.
 */
export interface Cluster {
  /** Where the group is drawn, as a percentage down the rail. */
  pct: number;
  items: Mark[];
}

export function cluster(marks: Mark[], total: number, minGapPct: number): Cluster[] {
  const pctOf = (ayah: number) => (total > 1 ? ((ayah - 1) / (total - 1)) * 100 : 0);
  const sorted = [...marks].sort((a, b) => a.ayah - b.ayah);
  const groups: { first: number; last: number; items: Mark[] }[] = [];

  for (const m of sorted) {
    const pct = pctOf(m.ayah);
    const open = groups[groups.length - 1];
    if (open && pct - open.last < minGapPct) {
      open.items.push(m);
      open.last = pct;
    } else {
      groups.push({ first: pct, last: pct, items: [m] });
    }
  }

  return groups.map((g) => ({ pct: (g.first + g.last) / 2, items: g.items }));
}
