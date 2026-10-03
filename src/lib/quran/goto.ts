import { foldToText } from "../match";
import { juzStart } from "./juz";

/**
 * Reading what a person types when they want to be somewhere else.
 *
 * Search answers "where does this occur"; this answers "take me there", and
 * the two are asked differently. Someone going somewhere types the least they
 * can get away with — `11`, `2 255`, `kahf`, `yaseen 12`, `juz 30` — on a
 * phone, one-handed, and spelled however they happen to spell it. So nothing
 * here is looked up over the network: it is read against the table of surahs
 * the site already holds, and the answer is there before the key is released.
 */

export interface SurahRow {
  id: number;
  english: string;
  arabic: string;
  meaning: string;
  ayat: number;
}

export interface Destination {
  surah: number;
  /** `null` is the head of the surah — its name and basmala, not its first ayah. */
  ayah: number | null;
  kind: "ayah" | "surah" | "juz";
  title: string;
  detail: string;
}

/**
 * A name, reduced to what survives every common way of writing it.
 *
 * `Yā-Sīn`, `Yaseen`, `ya sin` and `yasin` are one surah to the person typing,
 * as are `Al-Wāqiʿah` and `waqia`. Diacritics and punctuation go, the doubled
 * vowels of an English romanisation become the single ones of the academic
 * one, and doubled letters are written once — so `ar-Raḥmān`, `arrahman` and
 * `rahman` all contain the same six letters in the same order.
 */
function plain(text: string): string {
  return foldToText(text)
    .replace(/[^a-z0-9؀-ۿ]+/g, "")
    .replace(/ee/g, "i")
    .replace(/oo|ou/g, "u")
    .replace(/(.)\1+/g, "$1");
}

/**
 * The name without its article, which is the part people start typing at.
 *
 * Before a sun letter the article is assimilated — an-Nās, ar-Raḥmān — and
 * `plain` has already written that doubled letter once, so what is left of the
 * article there is its `a`. The digraphs are the exception: the two letters of
 * `sh` are not a doubled letter, so ash-Shams still has all of `ash` to lose.
 */
function bare(name: string): string {
  return name.replace(/^(al|ash(?=sh)|adh(?=dh)|ath(?=th)|a)(?=.{3})/, "");
}

function surahsNamed(name: string, surahs: SurahRow[]): SurahRow[] {
  const q = plain(name.replace(/^\s*(surah|surat|sura|سورة)\s+/i, ""));
  if (q.length < 2) return [];

  // The whole name first, then names beginning that way, then names that
  // merely contain it, then meanings: `nas` is an-Nās before it is an-Naṣr,
  // and `cow` finds al-Baqarah without having to be spelled.
  const rankOf = (row: SurahRow): number => {
    const english = plain(row.english);
    const stem = bare(english);
    if (english === q || stem === q || stem === bare(q)) return 0;
    if (english.startsWith(q) || stem.startsWith(q) || stem.startsWith(bare(q))) return 1;
    if (english.includes(q) || plain(row.arabic).includes(q)) return 2;
    if (q.length >= 3 && plain(row.meaning).includes(q)) return 3;
    return -1;
  };

  return surahs
    .map((row) => ({ row, rank: rankOf(row) }))
    .filter((r) => r.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.row.id - b.row.id)
    .map((r) => r.row);
}

const toSurah = (row: SurahRow): Destination => ({
  surah: row.id,
  ayah: null,
  kind: "surah",
  title: `${row.id} · ${row.english}`,
  detail: `${row.meaning} · ${row.ayat} ayat · from the beginning`,
});

const toAyah = (row: SurahRow, ayah: number): Destination => ({
  surah: row.id,
  ayah,
  kind: "ayah",
  title: `${row.english} ${row.id}:${ayah}`,
  detail: `Ayah ${ayah} of ${row.ayat}`,
});

/** The ayah if the surah has one of that number; otherwise the surah, saying why. */
function toPlace(row: SurahRow, ayah: number): Destination {
  if (ayah >= 1 && ayah <= row.ayat) return toAyah(row, ayah);
  return { ...toSurah(row), detail: `${row.english} has ${row.ayat} ayat — open it from the beginning` };
}

/**
 * Everywhere `query` could mean, best first. The first is what Enter does.
 *
 * `here` is the surah a bare number is read as an ayah of: the one the reader
 * is in, or the one they have picked out of the list.
 */
export function resolveGoto(query: string, surahs: SurahRow[], here: number): Destination[] {
  const raw = query.trim();
  if (!raw) return [];
  const byId = (id: number) => surahs.find((s) => s.id === id);

  // juz 30, juz' 2, j30 — the thirty parts are a way of finding a place too.
  const juz = /^(?:juz['’]?|para|sipara|j)\s*(\d{1,2})$/i.exec(raw);
  if (juz) {
    const start = juzStart(+juz[1]);
    const row = start && byId(start.surah);
    if (!start || !row) return [];
    return [
      {
        surah: start.surah,
        ayah: start.ayah === 1 ? null : start.ayah,
        kind: "juz",
        title: `Juz ${+juz[1]}`,
        detail: `Begins at ${row.english} ${start.surah}:${start.ayah}`,
      },
    ];
  }

  // 2:255, 2.255, 2 255, 2-255 — whichever separator the keyboard had to hand.
  const pair = /^(\d{1,3})\s*[:.,\-/\s]\s*(\d{1,3})$/.exec(raw);
  if (pair) {
    const row = byId(+pair[1]);
    return row ? [toPlace(row, +pair[2])] : [];
  }

  // A number alone is an ayah of the surah in hand first — that is the commoner
  // thing to want from inside a surah — and the surah of that number second.
  if (/^\d{1,3}$/.test(raw)) {
    const n = +raw;
    const out: Destination[] = [];
    const current = byId(here);
    if (current && n >= 1 && n <= current.ayat) {
      out.push({
        ...toAyah(current, n),
        title: `Ayah ${n}`,
        detail: `of ${current.english} · ${current.id}:${n}`,
      });
    }
    const numbered = byId(n);
    if (numbered) out.push(toSurah(numbered));
    return out;
  }

  // A name, with or without an ayah after it: kahf, kahf 10, yaseen:12.
  const named = /^(.*?\D)[\s:.,\-/]*(\d{1,3})?$/.exec(raw);
  if (!named) return [];
  const matches = surahsNamed(named[1], surahs).slice(0, 7);
  return matches.map((row) => (named[2] ? toPlace(row, +named[2]) : toSurah(row)));
}
