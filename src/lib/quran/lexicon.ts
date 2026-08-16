import type {
  Cognate,
  LexiconEntry,
  LexiconText,
  RootProfile,
  RootVerse,
  RootVersePage,
  WordSegments,
} from "./types";

/**
 * The one place in the application that knows where the morphology and the
 * lexicons come from.
 *
 * Everything above this file speaks in segments, roots and lexicon entries.
 * `api.ts` is the same arrangement for the Qur'anic text itself; the two are
 * kept apart because they are two different corpora with two different sets of
 * terms behind them, and either can be replaced without disturbing the other.
 *
 * ── what this connects to ────────────────────────────────────────────────
 *
 * al-nuqta (al-nuqta.com), an open, keyless API built for students of the
 * text. Two things are drawn from it and nothing else:
 *
 *   1. **Morphology** — root, lemma, part of speech and grammatical features
 *      per segment. This is the Quranic Arabic Corpus (Kais Dukes, Language
 *      Research Group, University of Leeds), decoded out of Buckwalter into
 *      Arabic. Its licence asks that the source be named and linked, which
 *      the word study panel and the settings page both do.
 *
 *   2. **The classical lexicons** — the entry for a root as it stands in Ibn
 *      Manẓūr's Lisān al-ʿArab, Ibn Fāris's Maqāyīs, al-Rāghib's Mufradāt,
 *      al-Zabīdī's Tāj al-ʿArūs, Lane and others: the Arabic the author wrote,
 *      a translation of it, and a link out to where it can be read in full.
 *
 * ── what is deliberately not drawn from it ───────────────────────────────
 *
 * The same API also serves machine-written prose: `ai_meaning` on a word,
 * `ai-translation` on an ayah, `detailed_meaning` and `primary_meaning` on a
 * root. None of it is requested here and none of it is displayed. This site's
 * rule is that a claim about the language carries the name of whoever made it,
 * and a generated gloss has no such name to carry. A reader is better served
 * by al-Rāghib with his death date beside him than by a fluent paragraph from
 * nobody — and where the lexicons say nothing, the honest screen is the one
 * that says they say nothing.
 */
const API = "https://al-nuqta.com/api/v1/";

/** Bumping this invalidates every cached lexicon response at once. */
const CACHE_VERSION = "mishkat-lexicon-v1";

const memory = new Map<string, unknown>();
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
 * Neither the grammar of an ayah nor a lexicon entry written in 1311 is going
 * to change, so a response fetched once is kept in memory for the session and
 * in Cache Storage across sessions — the same bargain `api.ts` strikes. It
 * matters more here: a full Lisān al-ʿArab entry is a heavy thing to fetch
 * twice, and the reader of a single surah will pass the same roots repeatedly.
 */
async function get<T>(path: string): Promise<T | null> {
  const url = API + path;
  const hit = memory.get(url);
  if (hit !== undefined) return hit as T;

  const store = await openCache();
  if (store) {
    const cached = await store.match(url);
    if (cached) {
      const json = (await cached.json()) as T;
      memory.set(url, json);
      return json;
    }
  }

  const res = await fetch(url);
  // A root the lexicons have not reached yet answers 404, and that is an
  // answer rather than a failure: the panel says so in as many words.
  if (res.status === 404) {
    memory.set(url, null);
    return null;
  }
  if (!res.ok) throw new Error(`Lexicon API responded ${res.status} for ${path}`);
  if (store) {
    try {
      await store.put(url, res.clone());
    } catch {
      /* quota, private mode — the memory map still serves the session */
    }
  }
  const json = (await res.json()) as T;
  memory.set(url, json);
  return json;
}

/** Roots are keyed in Buckwalter, and `$`, `'` and `*` are all real keys. */
const rootPath = (key: string) => encodeURIComponent(key);

/**
 * Roots and lemmas are Arabic script by definition, and a handful of them
 * arrive carrying a stray `^` — the residue of the corpus being transcoded out
 * of Buckwalter, where a caret has no Arabic to become. Three lemmas in
 * eighty-odd, so it is a transcoding artefact rather than anything the corpus
 * means to say.
 *
 * Dropping a character that is not Arabic from a field that is only ever
 * Arabic is a presentation fix and not an editorial one: nothing the source
 * asserts is altered, and a caret in the middle of رَبَٰئِب would read as a fault
 * in this site rather than as one upstream.
 */
function arabicOnly(s: string): string {
  return s.replace(/[^\p{Script=Arabic}\p{Mn}\s]/gu, "").trim();
}

// ── morphology ──────────────────────────────────────────────────────────────

interface RawSegment {
  form_arabic?: string;
  pos?: string;
  root_arabic?: string;
  root_buckwalter?: string;
  lemma_arabic?: string;
  features_raw?: string;
}

/**
 * The grammar of every word in one ayah. The ayah is the unit because it is
 * the unit the corpus serves and because a reader studying one word usually
 * looks at its neighbours next — one request covers the whole line.
 */
export async function fetchAyahMorphology(verseKey: string): Promise<WordSegments[]> {
  const j = await get<{
    data?: { words?: { position: number; segments?: RawSegment[] }[] };
  }>(`verses/${verseKey}/morphology`);

  return (j?.data?.words ?? []).map((w) => ({
    position: w.position,
    segments: (w.segments ?? []).map((s) => ({
      form: s.form_arabic ?? "",
      pos: s.pos ?? "",
      // The corpus spaces a root out as `ح م د`; the joined form is what reads
      // as a word, and both are wanted in different places on screen.
      root: arabicOnly(s.root_arabic ?? "").replace(/\s+/g, ""),
      rootSpaced: arabicOnly(s.root_arabic ?? ""),
      rootKey: s.root_buckwalter ?? "",
      lemma: arabicOnly(s.lemma_arabic ?? ""),
      raw: s.features_raw ?? "",
    })),
  }));
}

// ── the lexicons ────────────────────────────────────────────────────────────

interface RawEntry {
  entry_id: number;
  name_en?: string;
  name_ar?: string;
  author?: string;
  author_death_year?: number | null;
  is_quran_specific?: boolean;
  harmonized_en?: string;
  original_text_ar?: string;
  translation_en?: string;
  source_url?: string;
  ejtaal_url?: string;
}

function entry(e: RawEntry): LexiconEntry {
  return {
    id: e.entry_id,
    name: e.name_en ?? "Lexicon",
    nameArabic: e.name_ar ?? "",
    author: e.author ?? "",
    died: e.author_death_year ?? null,
    quranic: !!e.is_quran_specific,
    summary: (e.harmonized_en ?? "").trim(),
  };
}

/**
 * Every lexicon that has an entry for this root, oldest author first — so the
 * list reads as the word being handed down, and a later lexicographer's debt
 * to an earlier one is visible in the order rather than asserted.
 */
export async function fetchLexicon(rootKey: string): Promise<LexiconEntry[]> {
  const j = await get<{ data?: { dictionaries?: RawEntry[] } }>(
    `roots/${rootPath(rootKey)}/dictionaries`,
  );
  const rows = (j?.data?.dictionaries ?? []).map(entry);
  return rows.sort((a, b) => (a.died ?? 9999) - (b.died ?? 9999));
}

/**
 * One entry in full: the Arabic as its author set it down, and a translation of
 * that Arabic rather than of the summary. Both are shown, and the Arabic is
 * shown first, because the translation is the thing that can be wrong.
 */
export async function fetchLexiconText(id: number): Promise<LexiconText | null> {
  const j = await get<{ data?: RawEntry }>(`dictionaries/entries/${id}`);
  const d = j?.data;
  if (!d) return null;
  return {
    arabic: (d.original_text_ar ?? "").trim(),
    english: (d.translation_en ?? "").trim(),
    sourceUrl: d.source_url ?? "",
    scanUrl: d.ejtaal_url ?? "",
  };
}

// ── the root itself ─────────────────────────────────────────────────────────

interface RawRoot {
  root_arabic?: string;
  root_buckwalter?: string;
  total_occurrences?: number;
  lemmas?: { lemma_arabic?: string }[];
  cognate?: {
    transliteration?: string;
    derivatives?: {
      word?: string;
      displayed_text?: string;
      language?: string;
      language_family?: string;
      meaning?: string;
      date_from?: number | null;
      date_to?: number | null;
    }[];
  };
}

/**
 * What the corpus knows about a root as a whole: how often it occurs, which
 * lemmas grow out of it, and — kept clearly apart from the lexicons, because it
 * is comparative philology and not Arabic lexicography — its cognates in the
 * sister Semitic languages.
 */
export async function fetchRoot(rootKey: string): Promise<RootProfile | null> {
  const j = await get<{ data?: RawRoot }>(`roots/${rootPath(rootKey)}`);
  const d = j?.data;
  if (!d) return null;

  const cognates: Cognate[] = (d.cognate?.derivatives ?? [])
    .map((c) => ({
      word: c.displayed_text || c.word || "",
      language: c.language ?? "",
      family: c.language_family ?? "",
      meaning: c.meaning ?? "",
      from: c.date_from ?? null,
      to: c.date_to ?? null,
    }))
    .filter((c) => c.word && c.language)
    .sort((a, b) => (a.from ?? 0) - (b.from ?? 0));

  return {
    root: arabicOnly(d.root_arabic ?? "").replace(/\s+/g, ""),
    rootSpaced: arabicOnly(d.root_arabic ?? ""),
    key: d.root_buckwalter ?? rootKey,
    romanized: d.cognate?.transliteration ?? "",
    // Checked against the ayah count the verses endpoint reports: for every
    // root tried the two agree exactly, so this counts ayat and not words —
    // a root can occur twice in one ayah and be counted once here. The screen
    // says "ayat" for that reason and does not offer a word count it has not
    // got.
    ayat: d.total_occurrences ?? 0,
    lemmas: (d.lemmas ?? []).map((l) => arabicOnly(l.lemma_arabic ?? "")).filter(Boolean),
    cognates,
  };
}

/**
 * The ayat a root occurs in, fifty at a time — the corpus caps a page there and
 * a root like r-b-b runs to 871 of them, which is a list to be walked rather
 * than a list to be loaded. `total` is the whole count regardless of how much
 * of it has arrived, so the page can say how far down it is.
 */
export async function fetchRootVerses(rootKey: string, offset = 0): Promise<RootVersePage> {
  const j = await get<{
    data?: {
      verses?: {
        surah?: number;
        ayah?: number;
        text_uthmani?: string;
        translation?: string;
        matched_positions?: number[];
      }[];
    };
    meta?: { total?: number };
  }>(`roots/${rootPath(rootKey)}/verses?limit=50&offset=${offset}`);

  const verses: RootVerse[] = (j?.data?.verses ?? [])
    .filter((v) => v.surah && v.ayah)
    .map((v) => ({
      key: `${v.surah}:${v.ayah}`,
      arabic: v.text_uthmani ?? "",
      translation: v.translation ?? "",
      matched: v.matched_positions ?? [],
    }));
  return { verses, total: j?.meta?.total ?? verses.length };
}

/**
 * Where a reader goes to check any of this against something that is not us.
 * The Arabic Almanac puts the scanned pages of Lane, Hans Wehr, Hava and
 * Steingass on the screen for a root, which is as close to the printed page as
 * a link can get.
 */
export function scanUrl(rootKey: string): string {
  return `https://ejtaal.net/aa/#bwq=${encodeURIComponent(rootKey)}`;
}

/** The corpus that supplies the grammar, and whose licence asks to be named. */
export const MORPHOLOGY_SOURCE = {
  name: "The Quranic Arabic Corpus",
  href: "https://corpus.quran.com",
  served: "al-nuqta",
  servedHref: "https://al-nuqta.com",
} as const;
