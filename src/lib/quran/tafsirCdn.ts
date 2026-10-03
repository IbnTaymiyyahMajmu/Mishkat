/**
 * The one place in the application that knows about the Tafsir API.
 *
 * `spa5k/tafsir_api` on GitHub is a collection of tafsir editions as static
 * JSON, one small file to an ayah, served from a CDN that any page may read.
 * It is where the short tafsir in English comes from: tafsir.app's library is
 * in Arabic throughout, and a reader who does not read Arabic wants something
 * briefer to hand than the abridged Ibn Kathīr.
 *
 * ── what is taken, and what is not ────────────────────────────────────────
 *
 * Two editions, both checked ayah against ayah before being chosen:
 *
 *   `tafsir-al-jalalayn`       al-Jalālayn, in Feras Hamza's translation
 *   `en-tafsir-al-mukhtasar`   al-Mukhtaṣar, from Markaz Tafsīr
 *
 * The collection is uneven, and the rest was left for reasons worth writing
 * down so they are not rediscovered the hard way:
 *
 *   - its Arabic editions are the same texts tafsir.app holds, without the
 *     record of which ayat a passage covers and with some ayat missing;
 *   - its other al-Jalālayn (`en-al-jalalayn`) has lost its punctuation;
 *   - its Asbāb al-Nuzūl has another book's text under several ayat — the
 *     entry on 2:2 is not al-Wāḥidī at all — and to show that under his name
 *     would be to put words in his mouth;
 *   - its al-Qushayrī and its Kāshānī are, on half the ayat sampled, one text
 *     under two names, and all four of its Sufi commentaries have damaged
 *     characters in most entries;
 *   - its English Ibn Kathīr, Maʿārif and Tazkirul are the three the corpus
 *     already serves here with their headings intact.
 *
 * And what it does not have is English for the classical library. Its Ṭabarī,
 * Qurṭubī, Rāzī and the rest are listed under English titles and are Arabic
 * inside; every edition was opened to be sure. See `IN_ENGLISH` in `tafsir.ts`.
 *
 * The repository's licence covers the collection. The translations in it are
 * their translators' and publishers', so they are read from the CDN and
 * credited, not copied into this site.
 */

/** Pinned to a release: the CDN serves a tag unchanged for a year. */
const BASE = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@v1.2.2/tafsir";

/** Bumping this invalidates every cached passage at once. */
const CACHE_VERSION = "mishkat-tafsircdn-v1";

const memory = new Map<string, string>();
let cacheStore: Cache | null | undefined;

async function openCache(): Promise<Cache | null> {
  if (cacheStore !== undefined) return cacheStore;
  try {
    cacheStore = typeof caches !== "undefined" ? await caches.open(CACHE_VERSION) : null;
  } catch {
    cacheStore = null;
  }
  return cacheStore;
}

/**
 * The transliteration in one edition has been through something that turned
 * the long vowels and the emphatic consonants into capitals wherever they
 * fall: `lĀ rayba fĪhi`, `MuḤammad`. A capital with a macron or an underdot,
 * directly after a lower-case letter, is never what was written, so those are
 * put back. A capital that opens a name — `al-Ḥasan`, `Āmīn` — follows a
 * hyphen, a space or nothing, and is left alone.
 */
function repair(text: string): string {
  return text.replace(/(\p{Ll})([ĀĪŪḤṢḌṬẒ])/gu, (_, before: string, capital: string) => before + capital.toLowerCase());
}

/**
 * One edition's text on one ayah, or an empty string where it has none.
 *
 * A file that is not there is an answer — the edition says nothing on that
 * ayah — and is remembered as one. Anything else that goes wrong is thrown.
 */
export async function fetchCdnTafsir(edition: string, verseKey: string): Promise<string> {
  const [surah, ayah] = verseKey.split(":");
  const url = `${BASE}/${edition}/${surah}/${ayah}.json`;

  const hit = memory.get(url);
  if (hit !== undefined) return hit;

  const store = await openCache();
  let served = (await (await store?.match(url))?.json().catch(() => null)) as { text?: string } | null | undefined;

  if (!served) {
    const res = await fetch(url);
    if (res.status === 404) {
      memory.set(url, "");
      return "";
    }
    if (!res.ok) throw new Error(`The Tafsir API responded ${res.status} for ${edition} ${verseKey}`);
    if (store) {
      try {
        await store.put(url, res.clone());
      } catch {
        /* quota, private mode — the memory map still serves the session */
      }
    }
    served = (await res.json()) as { text?: string };
  }

  const text = repair(String(served?.text ?? "")).trim();
  memory.set(url, text);
  return text;
}

/** Where the collection lives, for the credit. */
export const TAFSIR_CDN = {
  name: "Tafsir API",
  href: "https://github.com/spa5k/tafsir_api",
} as const;
