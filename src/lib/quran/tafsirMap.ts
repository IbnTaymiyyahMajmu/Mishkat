import type { Para } from "./types";
import type { TafsirWork } from "./tafsir";

/**
 * How much each work says on an ayah, without reading what it says.
 *
 * `scripts/build-tafsir-map.mjs` measures this site's copy of every classical
 * work once — for each passage, the ayat it covers and the words it runs to —
 * and keeps it a surah to a file in `public/tafsir-map/`. This reads it back,
 * so a screen can show at a glance which of fifty works speak on an ayah and
 * at what length, for the price of one small file rather than fifty large
 * ones.
 *
 * The works not copied here — the corpus's, and the two English editions of
 * the Tafsir API — are short passages fetched one ayah at a time anyway, so
 * for those the passage itself is fetched and counted. Either way the answer
 * has the same shape, and the screen does not need to know which it was.
 */

/** A passage, measured: the ayat it covers, both inclusive, and its length. */
export interface Measure {
  from: number;
  to: number;
  words: number;
}

interface MapFile {
  v: number;
  surah: number;
  /** By the work's name in the copy: "tabari" → `[from, to, words][]`, in order. */
  works: Record<string, [number, number, number][]>;
}

const HOME = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/tafsir-map`;
const files = new Map<number, Promise<MapFile>>();

function load(surah: number): Promise<MapFile> {
  let asking = files.get(surah);
  if (!asking) {
    asking = fetch(`${HOME}/${surah}.json`).then((res) => {
      if (!res.ok) throw new Error(`tafsir map ${surah} answered ${res.status}`);
      return res.json() as Promise<MapFile>;
    });
    // A failure is forgotten, so the next attempt asks again.
    asking.catch(() => files.delete(surah));
    files.set(surah, asking);
  }
  return asking;
}

/** The copy's own name for a work this site holds, or nothing: "app:tabari" → "tabari". */
const copied = (work: TafsirWork) => (work.id.startsWith("app:") ? work.id.slice(4) : null);

/** Words, as a reader would count them: a run of letters between spaces. */
function countWords(paras: Para[]): number {
  let n = 0;
  for (const p of paras) {
    // An editor's note is not the author's, and the map leaves it out too.
    const own = p.text.replace(/\[\[[\s\S]*?\]\]/g, " ");
    for (const token of own.split(/\s+/)) if (/\p{L}/u.test(token)) n++;
  }
  return n;
}

/**
 * One work on one ayah, measured — or null, where the work has nothing on it.
 * Throws when the answer could not be reached, which is not the same thing.
 */
export async function measureTafsir(work: TafsirWork, verseKey: string): Promise<Measure | null> {
  const [surah, ayah] = verseKey.split(":").map(Number);
  const id = copied(work);
  if (id) {
    const map = await load(surah);
    const found = map.works[id]?.find(([from, to]) => from <= ayah && ayah <= to);
    return found ? { from: found[0], to: found[1], words: found[2] } : null;
  }
  const passage = await work.load(verseKey);
  const words = countWords(passage.paras);
  return words ? { from: passage.from, to: passage.to, words } : null;
}

/**
 * Which of these ayat a work has a passage on, from the map alone. A work not
 * copied here is not in the map, and is taken to cover them: those are whole
 * works, read an ayah at a time.
 */
export async function tafsirCovers(work: TafsirWork, verseKeys: string[]): Promise<Set<string>> {
  const id = copied(work);
  if (!id) return new Set(verseKeys);
  const covered = new Set<string>();
  await Promise.all(
    verseKeys.map(async (key) => {
      const [surah, ayah] = key.split(":").map(Number);
      const map = await load(surah).catch(() => null);
      if (map?.works[id]?.some(([from, to]) => from <= ayah && ayah <= to)) covered.add(key);
    }),
  );
  return covered;
}
