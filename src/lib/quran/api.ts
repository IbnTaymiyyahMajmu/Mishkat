import type { Chapter, SearchResult, Verse } from "./types";
import { htmlToParas, plainText } from "../text";
import type { Para } from "./types";

/**
 * The one place in the application that knows where the corpus comes from.
 *
 * Everything above this file speaks in chapters, verses, words and tafsir
 * passages. Swapping the Quran.com API for a local corpus or an own backend is
 * a rewrite of this file and nothing else.
 */
const API = "https://api.quran.com/api/v4/";
const AUDIO_CDN = "https://verses.quran.com/";

/** Bumping this invalidates every cached response at once. */
const CACHE_VERSION = "mishkat-quran-v1";

const memory = new Map<string, unknown>();
let cacheStore: Cache | null | undefined;

async function openCache(): Promise<Cache | null> {
  if (cacheStore !== undefined) return cacheStore;
  try {
    // Cache Storage needs a secure context; on plain http it is simply absent
    // and the in-memory map carries the session on its own.
    cacheStore = typeof caches !== "undefined" ? await caches.open(CACHE_VERSION) : null;
  } catch {
    cacheStore = null;
  }
  return cacheStore;
}

/**
 * The Qur'an does not change, so a response fetched once is good forever: it is
 * held in memory for the session and in Cache Storage across sessions. A second
 * visit to a surah costs no network at all.
 */
async function get<T>(path: string): Promise<T> {
  const url = API + path;
  const hit = memory.get(url);
  if (hit) return hit as T;

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
  if (!res.ok) throw new Error(`Quran API responded ${res.status} for ${path}`);
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

/** Search results are never cached: the query space is unbounded. */
async function getUncached<T>(path: string): Promise<T> {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`Quran API responded ${res.status} for ${path}`);
  return (await res.json()) as T;
}

// ── chapters ────────────────────────────────────────────────────────────────

export async function fetchChapters(): Promise<Chapter[]> {
  const j = await get<{ chapters: Chapter[] }>("chapters?language=en");
  return j.chapters ?? [];
}

export async function fetchChapterInfo(surah: number): Promise<Para[]> {
  const j = await get<{ chapter_info?: { text?: string } }>(
    `chapters/${surah}/info?language=en`,
  );
  return htmlToParas(j.chapter_info?.text);
}

// ── verses ──────────────────────────────────────────────────────────────────

export interface VerseQuery {
  translationId: number;
  reciterId: number;
  page?: number;
  perPage?: number;
}

function versePath(surah: number, q: VerseQuery): string {
  const params = new URLSearchParams({
    words: "true",
    per_page: String(q.perPage ?? 50),
    page: String(q.page ?? 1),
    translations: String(q.translationId),
    audio: String(q.reciterId),
    fields: "text_uthmani",
    translation_fields: "resource_name",
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
  return { verses: j.verses ?? [], totalPages: j.pagination?.total_pages ?? 1 };
}

export async function fetchVerse(key: string, translationId: number): Promise<Verse | null> {
  try {
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
  const params = new URLSearchParams({
    words: "true",
    translations: String(translationId),
    fields: "text_uthmani",
    translation_fields: "resource_name",
    word_fields: "text_uthmani,transliteration,location",
  });
  try {
    const j = await get<{ verse: Verse }>(`verses/by_key/${key}?${params}`);
    return j.verse ?? null;
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
    out.push(...(j.verses ?? []));
    const total = j.pagination?.total_pages ?? 1;
    if (page >= total) break;
    page += 1;
  }
  return out;
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
  const j = await getUncached<{
    search?: { results?: RawSearchResult[]; total_results?: number };
  }>(
    `search?q=${encodeURIComponent(query)}&size=${size}&page=0&language=en&translations=${translationId}`,
  );
  const raw = j.search?.results ?? [];
  const arabicQuery = /[؀-ۿ]/.test(query);
  const results: SearchResult[] = raw.map((r) => ({
    key: r.verse_key,
    arabic: joinWords(r) || r.text || "",
    snippet: plainText(r.translations?.[0]?.text),
    kind: arabicQuery ? "Qur'an text" : "Translation",
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

/** `"Alafasy/mp3/112001.mp3"` → an absolute URL on the recitation CDN. */
export function audioUrl(path: string): string {
  return path.startsWith("http") ? path : AUDIO_CDN + path;
}
