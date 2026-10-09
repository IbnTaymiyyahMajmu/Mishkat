import type { AudioSegment, Chapter, SearchResult, Verse, VerseTranslation } from "./types";
import { htmlToParas, plainText } from "../text";
import type { Para } from "./types";
import { keptJson } from "./kept";
import { DEFAULT_TRANSLATION } from "./resources";
import { fetchFiledAyah, fetchFiledSurah, filedEdition, type FiledEdition } from "./translationFiles";

/**
 * The one place in the application that knows where the corpus comes from.
 *
 * Everything above this file speaks in chapters, verses, words and tafsir
 * passages. Swapping the Quran.com API for a local corpus or an own backend is
 * a rewrite of this file and nothing else.
 *
 * The corpus is the Quran Foundation's, and it is served at two addresses.
 *
 *   - `api.quran.com` answers anyone, without a key. It is what this site has
 *     read from the start, and what it reads unless told otherwise.
 *   - `apis.quran.foundation` is the same corpus behind the Foundation's
 *     developer programme: the same paths and the same answers, asked for
 *     with a token. The token is bought with a client secret, and a secret
 *     cannot be given to a page — whatever is in a page is given to every
 *     reader of it. So the secret is held by a relay (`scripts/qf-relay.mjs`),
 *     and when `NEXT_PUBLIC_QF_RELAY` names one, the corpus is read through it.
 *
 * Nothing else changes between the two: the Foundation kept the contract when
 * it added the door. Search is the exception, and says so below.
 */
const PUBLIC_API = "https://api.quran.com/api/v4/";
const RELAY = (process.env.NEXT_PUBLIC_QF_RELAY ?? "").replace(/\/+$/, "");
const API = RELAY ? `${RELAY}/content/api/v4/` : PUBLIC_API;
const AUDIO_CDN = "https://verses.quran.com/";

/** Whether the corpus is being read through the Foundation's developer API. */
export const THROUGH_FOUNDATION = !!RELAY;

/** Asked of the corpus, and kept for a week: see `kept.ts`. */
const get = <T>(path: string): Promise<T> => keptJson<T>(API + path, `the Quran API, ${path}`);

/**
 * Search results are never cached: the query space is unbounded.
 *
 * And search is always asked of the open address. The Foundation's developer
 * API does not carry this endpoint — search there is a separate product with a
 * permission of its own (`scope=search`) and a different shape of answer. When
 * that permission is held, this function is the one to rewrite.
 */
async function getUncached<T>(path: string): Promise<T> {
  const res = await fetch(PUBLIC_API + path);
  if (!res.ok) throw new Error(`Quran API responded ${res.status} for ${path}`);
  return (await res.json()) as T;
}

// ── chapters ────────────────────────────────────────────────────────────────

export async function fetchChapters(): Promise<Chapter[]> {
  const j = await get<{ chapters: Chapter[] }>("chapters?language=en");
  return j.chapters ?? [];
}

// ── verses ──────────────────────────────────────────────────────────────────

export interface VerseQuery {
  reciterId: number;
  /** The language the meaning under each word is given in. */
  glossLanguage: string;
  page?: number;
  perPage?: number;
}

/**
 * The surah as it is studied: every word, with its transliteration and its
 * meaning, and the recitation's timings.
 *
 * The translation is not asked for here. It used to be, which made the
 * translation part of the name of the answer: choosing another fetched
 * al-Baqarah's 1.6 MB of words a second time to change 100 KB of English, and
 * took the Arabic off the screen while it did. The translations are their own
 * request now — `fetchSurahTranslation` — and are laid over this one.
 */
function versePath(surah: number, q: VerseQuery): string {
  const params = new URLSearchParams({
    words: "true",
    per_page: String(q.perPage ?? 50),
    page: String(q.page ?? 1),
    language: q.glossLanguage,
    audio: String(q.reciterId),
    fields: "text_uthmani",
    word_fields: "text_uthmani,transliteration,location",
  });
  return `verses/by_chapter/${surah}?${params}`;
}

export interface VersePage {
  verses: Verse[];
  totalPages: number;
}

export async function fetchVersePage(surah: number, q: VerseQuery): Promise<VersePage> {
  const j = await get<{
    verses: Verse[];
    pagination?: { total_pages?: number };
  }>(versePath(surah, q));
  return { verses: timed(j.verses ?? []), totalPages: j.pagination?.total_pages ?? 1 };
}

/**
 * Word timings, as numbers.
 *
 * The corpus sends them as numbers for most reciters and as strings for some
 * — al-Sudays' arrive as `["0","1","170","6400"]` — and the type above says
 * numbers. Everything downstream does arithmetic on them, so they are made
 * what they are declared to be here, once, rather than each caller finding
 * out for itself. A segment that is not four numbers is dropped: it cannot be
 * used to time a word and should not be mistaken for one that can.
 *
 * Done in place. The responses are cached and shared, and a second pass over
 * the same verses finds nothing left to change.
 */
function timed(verses: Verse[]): Verse[] {
  for (const verse of verses) {
    const segments = verse.audio?.segments as unknown[] | undefined;
    if (!verse.audio || !Array.isArray(segments)) continue;
    verse.audio.segments = segments
      .filter((s): s is unknown[] => Array.isArray(s) && s.length >= 4)
      .map((s) => s.slice(0, 4).map(Number) as AudioSegment)
      .filter((s) => s.every(Number.isFinite));
  }
  return verses;
}

/**
 * An ayah the corpus sent, with a translation it did not send put under it.
 *
 * A translation held as files (`translationFiles.ts`) is not something the
 * corpus can be asked for, so the ayah is asked for bare and the translation
 * is laid on it here — in the shape the corpus would have sent it in, so that
 * nothing above this file has to know there are two sources. A copy is made:
 * the corpus's answer is kept and shared, and is not to be written on.
 */
async function withFiled(verse: Verse | undefined, key: string, edition: FiledEdition): Promise<Verse | null> {
  if (!verse) return null;
  const text = await fetchFiledAyah(edition, key);
  return {
    ...verse,
    translations: text ? [{ resource_id: edition.id, resource_name: edition.name, text }] : [],
  };
}

export async function fetchVerse(key: string, translationId: number): Promise<Verse | null> {
  try {
    const filed = filedEdition(translationId);
    if (filed) {
      const j = await get<{ verse: Verse }>(`verses/by_key/${key}?fields=text_uthmani`);
      return withFiled(j.verse, key, filed);
    }
    const j = await get<{ verse: Verse }>(
      `verses/by_key/${key}?fields=text_uthmani&translations=${translationId}&translation_fields=resource_name`,
    );
    return j.verse ?? null;
  } catch {
    return null;
  }
}

/**
 * One ayah with its words attached. The reader already holds this for the surah
 * it is showing, so this is for the screens that arrive at a single ayah cold —
 * the study page opens on a word and has no surah loaded behind it.
 */
export async function fetchVerseWithWords(
  key: string,
  translationId: number,
): Promise<Verse | null> {
  const filed = filedEdition(translationId);
  const params = new URLSearchParams({
    words: "true",
    ...(filed ? {} : { translations: String(translationId), translation_fields: "resource_name" }),
    fields: "text_uthmani",
    word_fields: "text_uthmani,transliteration,location",
  });
  try {
    const j = await get<{ verse: Verse }>(`verses/by_key/${key}?${params}`);
    return filed ? withFiled(j.verse, key, filed) : (j.verse ?? null);
  } catch {
    return null;
  }
}

/**
 * The whole surah as Uthmānī text and nothing else — no words, no translation,
 * no audio. This is what the muṣḥaf view reads, and it is a fraction of the
 * weight of the study payload: al-Baqarah is 100 KB here against 1.6 MB there.
 */
export async function fetchMushaf(surah: number): Promise<Verse[]> {
  const out: Verse[] = [];
  let page = 1;
  for (;;) {
    const j = await get<{ verses: Verse[]; pagination?: { total_pages?: number } }>(
      `verses/by_chapter/${surah}?per_page=286&page=${page}&fields=text_uthmani`,
    );
    out.push(...(j.verses ?? []));
    const total = j.pagination?.total_pages ?? 1;
    if (page >= total) break;
    page += 1;
  }
  return out;
}

/**
 * The surah with its recitation attached and nothing else. The muṣḥaf view
 * loads this only if the reader actually presses play, so simply reading does
 * not pay for audio metadata it never uses.
 */
export async function fetchRecitation(surah: number, reciterId: number): Promise<Verse[]> {
  const out: Verse[] = [];
  let page = 1;
  for (;;) {
    const j = await get<{ verses: Verse[]; pagination?: { total_pages?: number } }>(
      `verses/by_chapter/${surah}?per_page=286&page=${page}&audio=${reciterId}&fields=text_uthmani`,
    );
    out.push(...timed(j.verses ?? []));
    const total = j.pagination?.total_pages ?? 1;
    if (page >= total) break;
    page += 1;
  }
  return out;
}

// ── translations ────────────────────────────────────────────────────────────

/** A translation as the corpus lists it. */
export interface RawEdition {
  id: number;
  name: string;
  author_name: string | null;
  slug: string | null;
  language_name: string;
}

/** Every translation the corpus offers, in every language: some 125 of them. */
export async function fetchEditions(): Promise<RawEdition[]> {
  const j = await get<{ translations?: RawEdition[] }>("resources/translations");
  return j.translations ?? [];
}

export interface RawLanguage {
  name: string;
  iso_code: string;
  native_name: string | null;
  direction: string;
}

/** The languages, for what each calls itself and how it is addressed. */
export async function fetchLanguages(): Promise<RawLanguage[]> {
  const j = await get<{ languages?: RawLanguage[] }>("resources/languages");
  return j.languages ?? [];
}

/** One ayah in one translation: the text as it came, and its footnotes. */
export interface TranslatedAyah {
  text: string;
  /** By the id the text's own marks carry. Empty where there are none. */
  footnotes: Record<string, string>;
}

export interface SurahTranslation {
  /** The translation's name as the corpus gives it with the text. */
  name: string;
  ayat: Map<string, TranslatedAyah>;
}

/**
 * A whole surah in one translation, in one answer, with the footnotes in it.
 *
 * The footnotes are the reason this is its own request. A translator's note is
 * part of the translation — Saheeh International explains "We" on the second
 * page and relies on it for six hundred more — and the endpoint that sends an
 * ayah with its words sends the marks without the notes they point to.
 */
export async function fetchSurahTranslation(id: number, surah: number): Promise<SurahTranslation> {
  // One held as files is read from its files, and comes without notes.
  const filed = filedEdition(id);
  if (filed) {
    const ayat = new Map<string, TranslatedAyah>();
    for (const [ayah, text] of await fetchFiledSurah(filed, surah)) {
      ayat.set(`${surah}:${ayah}`, { text, footnotes: {} });
    }
    return { name: filed.name, ayat };
  }

  const j = await get<{
    translations?: { verse_key?: string; text?: string; foot_notes?: Record<string, string> | null }[];
    meta?: { translation_name?: string };
  }>(`quran/translations/${id}?chapter_number=${surah}&foot_notes=true&fields=verse_key`);
  const ayat = new Map<string, TranslatedAyah>();
  for (const t of j.translations ?? []) {
    if (t.verse_key && t.text) ayat.set(t.verse_key, { text: t.text, footnotes: t.foot_notes ?? {} });
  }
  // A translation the corpus no longer carries answers with an empty list.
  if (!ayat.size) throw new Error(`Translation ${id} has nothing for surah ${surah}`);
  return { name: j.meta?.translation_name ?? "", ayat };
}

/**
 * One ayah as several translators rendered it, by translation id.
 *
 * The ids are put in order before asking, so the same set asked for twice is
 * one answer kept rather than two.
 */
export async function fetchRenderings(key: string, ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!ids.length) return out;

  // The corpus is asked for its own, the files for theirs, and neither waits
  // on the other. A file that cannot be had costs that one rendering.
  const filed = ids.map(filedEdition).filter((e): e is FiledEdition => !!e);
  const fromFiles = Promise.all(
    filed.map(async (edition) => {
      const text = await fetchFiledAyah(edition, key);
      if (text) out.set(edition.id, text);
    }),
  );

  const sorted = ids
    .filter((id) => !filedEdition(id))
    .sort((a, b) => a - b)
    .join(",");
  if (sorted) {
    const j = await get<{ verse?: { translations?: VerseTranslation[] } }>(
      `verses/by_key/${key}?translations=${sorted}`,
    );
    for (const t of j.verse?.translations ?? []) {
      if (t.resource_id != null && t.text) out.set(t.resource_id, t.text);
    }
  }
  await fromFiles;
  return out;
}

/** One footnote, for a rendering that arrived with its marks and not its notes. */
export async function fetchFootnote(id: string): Promise<string> {
  const j = await get<{ foot_note?: { text?: string } }>(`foot_notes/${encodeURIComponent(id)}`);
  return j.foot_note?.text ?? "";
}

// ── tafsir ──────────────────────────────────────────────────────────────────

export async function fetchTafsir(key: string, tafsirId: number): Promise<Para[]> {
  const j = await get<{ tafsir?: { text?: string } }>(`tafsirs/${tafsirId}/by_ayah/${key}`);
  return htmlToParas(j.tafsir?.text);
}

// ── search ──────────────────────────────────────────────────────────────────

interface RawSearchResult {
  verse_key: string;
  text?: string;
  words?: { char_type?: string; text?: string }[];
  translations?: { text: string }[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}

export async function search(
  query: string,
  translationId: number,
  size = 25,
): Promise<SearchResponse> {
  // The index is the corpus's, and holds the corpus's translations. A reader
  // whose first translation is one held as files is searched for in the
  // corpus's usual one, and shown what was matched there.
  const searched = filedEdition(translationId) ? DEFAULT_TRANSLATION : translationId;
  const j = await getUncached<{
    search?: { results?: RawSearchResult[]; total_results?: number };
  }>(
    `search?q=${encodeURIComponent(query)}&size=${size}&page=0&language=en&translations=${searched}`,
  );
  const raw = j.search?.results ?? [];
  const arabicQuery = /[؀-ۿ]/.test(query);
  const results: SearchResult[] = raw.map((r) => ({
    key: r.verse_key,
    arabic: joinWords(r) || r.text || "",
    snippet: plainText(r.translations?.[0]?.text),
    kind: arabicQuery ? "quran" : "translation",
  }));
  return { results, total: j.search?.total_results ?? results.length };
}

function joinWords(r: RawSearchResult): string {
  return (r.words ?? [])
    .filter((w) => w.char_type === "word")
    .map((w) => w.text)
    .join(" ");
}

/**
 * Every ayah in which a bare word form occurs, and how many there are in all.
 *
 * The count is the index's own total rather than the length of what came back,
 * so a page asking "how often does this exact form occur" gets the answer
 * instead of the size of the sample it was shown.
 */
export async function fetchOccurrences(
  form: string,
  size = 8,
): Promise<{ rows: { key: string; text: string }[]; total: number }> {
  const j = await getUncached<{
    search?: { results?: RawSearchResult[]; total_results?: number };
  }>(`search?q=${encodeURIComponent(form)}&size=${size}&page=0&language=en`);
  const rows = (j.search?.results ?? []).map((r) => ({
    key: r.verse_key,
    text: joinWords(r) || r.text || "",
  }));
  return { rows, total: j.search?.total_results ?? rows.length };
}

// ── audio ───────────────────────────────────────────────────────────────────

/**
 * `"Alafasy/mp3/112001.mp3"` → an absolute URL on the recitation CDN.
 *
 * Some reciters are not held on that CDN at all, and the corpus gives their
 * recordings as absolute or protocol-relative URLs elsewhere. Those are already
 * whole addresses and must be left alone rather than hung off the CDN.
 */
export function audioUrl(path: string): string {
  if (path.startsWith("http")) return path;
  if (path.startsWith("//")) return `https:${path}`;
  return AUDIO_CDN + path;
}
