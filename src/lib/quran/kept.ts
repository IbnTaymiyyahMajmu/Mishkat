/**
 * Answers, kept.
 *
 * Everything this site reads over the network that is not the reader's own —
 * the corpus, the translations held as files — is read through here, so that
 * a second visit to a surah costs no network at all, and so that how long a
 * copy may be kept is decided in one place.
 */

/** Bumping this invalidates every cached response at once. */
const CACHE_VERSION = "mishkat-quran-v2";
const CACHE_FAMILY = "mishkat-quran-";

/**
 * How long an answer is kept before its source is asked again.
 *
 * It used to be for ever, on the reasoning that the Qur'an does not change.
 * The Qur'an does not; what is hung on it does. A translation is corrected,
 * and one is taken out of the corpus altogether — The Clear Qur'an was, and a
 * reader who had opened a surah in it went on being shown the corpus's copy
 * there and nothing anywhere else. A week is also the longest the Quran
 * Foundation's terms let a copy be kept, and the lifetime its own servers put
 * on an answer.
 */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
/** When an answer was kept, written on the copy: a response does not say. */
const KEPT_AT = "x-mishkat-kept-at";

const memory = new Map<string, unknown>();
/** Requests on their way, so two askers of one thing share one answer. */
const inflight = new Map<string, Promise<unknown>>();
let cacheStore: Cache | null | undefined;

async function openCache(): Promise<Cache | null> {
  if (cacheStore !== undefined) return cacheStore;
  try {
    // Cache Storage needs a secure context; on plain http it is simply absent
    // and the in-memory map carries the session on its own.
    cacheStore = typeof caches !== "undefined" ? await caches.open(CACHE_VERSION) : null;
    // What an earlier build kept is no use to this one, and is megabytes.
    if (cacheStore) {
      void caches
        .keys()
        .then((names) =>
          names
            .filter((n) => n.startsWith(CACHE_FAMILY) && n !== CACHE_VERSION)
            .forEach((n) => void caches.delete(n)),
        )
        .catch(() => {});
    }
  } catch {
    cacheStore = null;
  }
  return cacheStore;
}

/** The source said no, as opposed to not being reached. */
class Refused extends Error {}

/**
 * An answer fetched once is held in memory for the session and in Cache Storage
 * for a week.
 *
 * Past the week its source is asked again. If it cannot be reached — a train, a
 * plane, a server having a bad hour — the old copy is read rather than nothing.
 * If it is reached and says the thing is no longer there, the old copy goes:
 * that is a withdrawal, and keeping it would be showing what was taken back.
 *
 * @param label what to call the request in an error, where the URL is too much
 */
export function keptJson<T>(url: string, label = url): Promise<T> {
  const hit = memory.get(url);
  if (hit) return Promise.resolve(hit as T);

  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;

  const asked = read<T>(url, label).finally(() => inflight.delete(url));
  inflight.set(url, asked);
  return asked;
}

async function read<T>(url: string, label: string): Promise<T> {
  const store = await openCache();
  let old: T | undefined;
  if (store) {
    const cached = await store.match(url);
    if (cached) {
      const json = (await cached.json()) as T;
      if (Date.now() - Number(cached.headers.get(KEPT_AT) ?? 0) < KEEP_MS) {
        memory.set(url, json);
        return json;
      }
      old = json;
    }
  }

  try {
    const res = await fetch(url);
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      throw new Refused(`${res.status} for ${label}`);
    }
    if (!res.ok) throw new Error(`${res.status} for ${label}`);
    const text = await res.text();
    const json = JSON.parse(text) as T;
    if (store) {
      try {
        await store.put(
          url,
          new Response(text, {
            headers: { "Content-Type": "application/json", [KEPT_AT]: String(Date.now()) },
          }),
        );
      } catch {
        /* quota, private mode — the memory map still serves the session */
      }
    }
    memory.set(url, json);
    return json;
  } catch (error) {
    if (error instanceof Refused) {
      if (old !== undefined) void store?.delete(url);
      throw error;
    }
    if (old === undefined) throw error;
    memory.set(url, old);
    return old;
  }
}
