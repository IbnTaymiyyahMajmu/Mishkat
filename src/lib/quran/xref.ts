import { SURAH_NAMES } from "./surahNames";
import { fetchMirroredPassage } from "./tafsirApp";

/**
 * The Qurʾān explained by the Qurʾān.
 *
 * When a commentator explains an ayah he very often does it with another —
 * "and He has made it plain elsewhere, in His saying: …" — and the copy of his
 * book marks every such quotation. `scripts/build-xref.mjs` reads them across
 * the eleven works the site quotes from and writes, for each surah, which
 * ayat its commentators brought in and which commentaries elsewhere bring its
 * ayat in. This is the one file that reads that back.
 *
 * Nothing here decides that two ayat are related. Every link is a place where
 * a named scholar, in his own book, quoted one ayah while explaining another —
 * and the screen can always show the sentence he did it in.
 */

/** A work of tafsir by its id in the copy: "adwaa-albayan", "tabari". */
export type XrefWork = string;

/** One place a commentator quotes an ayah: which work, which passage, where in it. */
export interface XrefCitation {
  work: XrefWork;
  /** The passage the quotation stands in: its surah and the ayat it covers. */
  surah: number;
  from: number;
  to: number;
  /** The ayah of the passage he was explaining when he quoted it. */
  about: number;
  /** Where in the stored passage the quotation begins. */
  at: number;
}

/** An ayah, and every citation that links it to the one being read. */
export interface XrefLink {
  key: string;
  surah: number;
  ayah: number;
  /** The distinct works among the citations, in the order the screen lists works. */
  works: XrefWork[];
  citations: XrefCitation[];
}

export interface AyahXrefs {
  /** The ayat this ayah's commentators brought in to explain it. */
  brought: XrefLink[];
  /** The ayat whose commentators brought this one in. */
  bringing: XrefLink[];
}

interface XrefFile {
  v: number;
  surah: number;
  works: XrefWork[];
  /** [work, from, to, [target, at, about, target, at, about, …]] */
  out: [number, number, number, number[]][];
  /** ayah → [work, sourceIndex, at, work, sourceIndex, at, …] */
  in: Record<string, number[]>;
}

// ── ayat as one count ───────────────────────────────────────────────────────

/** Where each surah begins in a count of all 6,236 ayat. */
const OFFSET: number[] = SURAH_NAMES.reduce<number[]>((acc, s, i) => (acc.push(acc[i] + s.ayat), acc), [0]);

/** An ayah from its place among all 6,236, counted from 1. */
function ayahAt(index: number): { surah: number; ayah: number } {
  let lo = 1;
  let hi = 114;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (OFFSET[mid] < index) lo = mid + 1;
    else hi = mid;
  }
  return { surah: lo, ayah: index - OFFSET[lo - 1] };
}

// ── reading the files ───────────────────────────────────────────────────────

const HOME = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/xref`;
const files = new Map<number, Promise<XrefFile>>();

function load(surah: number): Promise<XrefFile> {
  let asking = files.get(surah);
  if (!asking) {
    asking = fetch(`${HOME}/${surah}.json`).then((res) => {
      if (!res.ok) throw new Error(`xref ${surah} answered ${res.status}`);
      return res.json() as Promise<XrefFile>;
    });
    asking.catch(() => files.delete(surah));
    files.set(surah, asking);
  }
  return asking;
}

/** Links, most commentators first; among equals the one al-Shinqīṭī brings, then muṣḥaf order. */
function ranked(links: Map<string, XrefLink>, order: XrefWork[]): XrefLink[] {
  const rank = (w: XrefWork) => order.indexOf(w);
  return [...links.values()]
    .map((link) => ({ ...link, works: [...new Set(link.works)].sort((a, b) => rank(a) - rank(b)) }))
    .sort(
      (a, b) =>
        b.works.length - a.works.length ||
        Number(b.works[0] === order[0]) - Number(a.works[0] === order[0]) ||
        b.citations.length - a.citations.length ||
        a.surah - b.surah ||
        a.ayah - b.ayah,
    );
}

function link(into: Map<string, XrefLink>, surah: number, ayah: number, citation: XrefCitation) {
  const key = `${surah}:${ayah}`;
  const held = into.get(key);
  if (held) {
    held.citations.push(citation);
    held.works.push(citation.work);
  } else {
    into.set(key, { key, surah, ayah, works: [citation.work], citations: [citation] });
  }
}

/** Both directions for one ayah. */
export async function fetchAyahXrefs(verseKey: string): Promise<AyahXrefs> {
  const [surah, ayah] = verseKey.split(":").map(Number);
  const file = await load(surah);

  const brought = new Map<string, XrefLink>();
  for (const [w, from, to, refs] of file.out) {
    if (ayah < from || ayah > to) continue;
    for (let i = 0; i < refs.length; i += 3) {
      if (refs[i + 2] !== ayah) continue;
      const target = ayahAt(refs[i]);
      link(brought, target.surah, target.ayah, { work: file.works[w], surah, from, to, about: ayah, at: refs[i + 1] });
    }
  }

  const bringing = new Map<string, XrefLink>();
  const flat = file.in[String(ayah)] ?? [];
  for (let i = 0; i < flat.length; i += 3) {
    const source = ayahAt(flat[i + 1]);
    link(bringing, source.surah, source.ayah, {
      work: file.works[flat[i]],
      surah: source.surah,
      from: source.ayah,
      to: source.ayah,
      about: source.ayah,
      at: flat[i + 2],
    });
  }

  return { brought: ranked(brought, file.works), bringing: ranked(bringing, file.works) };
}

/**
 * How many ayat were brought in to explain each ayah of a surah, by ayah — for
 * the line under an ayah that says there are some.
 */
export async function fetchSurahXrefCounts(surah: number): Promise<Map<number, number>> {
  const file = await load(surah);
  const sets = new Map<number, Set<number>>();
  for (const [, , , refs] of file.out) {
    for (let i = 0; i < refs.length; i += 3) {
      const about = refs[i + 2];
      let set = sets.get(about);
      if (!set) sets.set(about, (set = new Set()));
      set.add(refs[i]);
    }
  }
  return new Map([...sets].map(([a, set]) => [a, set.size]));
}

// ── the commentator's sentence ──────────────────────────────────────────────

/** A stretch of a commentator's prose, and which parts of it are the Qurʾān. */
export interface XrefExcerpt {
  /** In order: prose, then a quotation, then prose… Odd-numbered pieces are the Qurʾān. */
  pieces: string[];
  /** Whether the sentence was cut short at either end. */
  clippedStart: boolean;
  clippedEnd: boolean;
}

const BEFORE = 260;
const AFTER = 220;
/** Where a sentence may be taken to begin or end. */
const STOPS = ["\n", ". ", "؛", "* * *"];

/**
 * The sentence a commentator quotes an ayah in, cut from his passage: from the
 * start of that sentence, through the quotation and its reference, to the end
 * of it — or as near as a few hundred letters allow. The page marks of the
 * printed edition are taken out, and so are its editors' notes, which are the
 * editors' and not his.
 */
export async function fetchXrefExcerpt(citation: XrefCitation): Promise<XrefExcerpt | null> {
  const passage = await fetchMirroredPassage(citation.work, citation.surah, citation.from);
  if (!passage) return null;
  const text = passage.text;
  const at = Math.min(Math.max(0, citation.at), text.length);

  // Back to where the sentence begins.
  let start = Math.max(0, at - BEFORE);
  let clippedStart = start > 0;
  for (const stop of STOPS) {
    const found = text.lastIndexOf(stop, at - 1);
    if (found >= 0 && found + stop.length > start && found < at) {
      start = found + stop.length;
      clippedStart = false;
    }
  }

  // On past the quotation — and the reference after it — to where it ends. A
  // quotation is ﴿…﴾ everywhere but in al-Qurṭubī's edition, which also quotes
  // between plain quotation marks.
  const closer = text[at] === "﴿" ? "﴾" : text[at] === '"' ? '"' : "";
  const close = closer ? text.indexOf(closer, at + 1) : -1;
  const after = close > at ? close + 1 : at + 1;
  let end = Math.min(text.length, after + AFTER);
  let clippedEnd = end < text.length;
  let nearest = end;
  for (const stop of STOPS) {
    const found = text.indexOf(stop, after);
    if (found >= 0 && found < nearest) nearest = found + (stop === ". " ? 1 : 0);
  }
  if (nearest < end) {
    end = nearest;
    clippedEnd = false;
  }

  const excerpt = text
    .slice(start, end)
    .replace(/\(p-[\d٠-٩]+\)/g, "")
    .replace(/\[\[[\s\S]*?\]\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return { pieces: excerpt.split(/﴿([^﴾]*)﴾/), clippedStart, clippedEnd };
}
