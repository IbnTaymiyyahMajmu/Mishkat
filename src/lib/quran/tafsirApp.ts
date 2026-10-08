import type { Para } from "./types";
import works from "./tafsirWorks.json";
import mirror from "@/content/tafsir-mirror.json";

/**
 * The one place in the application that knows about tafsir.app.
 *
 * tafsir.app — الباحث القرآني, built by Nuqayah — holds the classical tafsir
 * library set out ayah by ayah: some forty works, in the Arabic their authors
 * wrote. It is by a long way the richest place to read tafsir against a single
 * ayah. This site does not take all of it. It takes the works a reader is
 * most likely to want — see the note on the catalogue below — and sends them
 * to tafsir.app for the rest.
 *
 * ── where a passage comes from ────────────────────────────────────────────
 *
 * **From this site's own copy.** With Nuqayah's permission the works are
 * copied here by `scripts/mirror-tafsir.mjs`, into `public/tafsir`, and a work
 * that has been copied is read from there: static files, served with the
 * site, needing nobody else's server to be up. `src/content/tafsir-mirror.json`
 * is the script's record of which works those are, and is how the build knows.
 *
 * **From tafsir.app, through a relay.** A work that has not been copied can
 * still be read in the panel if `NEXT_PUBLIC_TAFSIR_APP_BASE` names somewhere
 * to fetch it from. tafsir.app does not let a page on another site read its
 * answers directly, so that is either tafsir.app once it allows this site's
 * address, or the relay in `scripts/tafsir-proxy.mjs`.
 *
 * **By a link.** Failing both, the work is a link: every work on tafsir.app
 * has an address for every ayah — `tafsir.app/tabari/2/255` — and the reader
 * is sent straight to the passage.
 *
 * Whichever it is, a passage is shown under its book and its author, in
 * Arabic as written, with the way back to it on tafsir.app beside it. The copy
 * is a convenience to the reader, not a claim on the work.
 */

export const TAFSIR_APP = {
  name: "tafsir.app",
  nameArabic: "الباحث القرآني",
  by: "Nuqayah",
  href: "https://tafsir.app",
} as const;

export interface TafsirAppWork {
  /** How tafsir.app addresses the work: `tafsir.app/<id>/<surah>/<ayah>`. */
  id: string;
  /** What the work is called for short — by its author, as readers do. */
  short: string;
  name: string;
  /** The title put into English, for a reader to whom the Arabic says nothing. */
  nameEnglish: string;
  nameArabic: string;
  /** The author as readers call him, and the book's own title, in Arabic letters. */
  shortArabic?: string;
  titleArabic?: string;
  author: string;
  authorArabic?: string;
  /** One line on what the work is and what to expect of it. */
  about: string;
  /** The year the author died, AH. */
  died: number | null;
  /** How the authorship is printed, where a name and a date do not cover it. */
  credit?: string;
  /** When it is from, in a word, where the year of one death does not say. */
  era?: string;
  /**
   * What kind of tafsir it is, in tafsir.app's own division of the library and
   * in English. This is why the work is here: it stands for its kind.
   */
  field: string;
  fieldArabic: string;
}

/**
 * The works this site holds: a shelf, not the library.
 *
 * tafsir.app sorts its tafsir by what each sets out to do — the mother works
 * that the rest lean on, those that gather the opinions, the encyclopaedic,
 * the concise, the linguistic, and so on. All four of the mother works are
 * here, because they are the ones everything else cites. From each of the
 * other kinds there is one, the work that kind is best known by:
 *
 *   gathering the opinions   Zād al-masīr — Ibn al-Jawzī sets the views side
 *                            by side and names who held each
 *   encyclopaedic            Mafātīḥ al-ghayb — al-Rāzī
 *   concise                  Anwār al-tanzīl — al-Bayḍāwī, taught from for
 *                            seven centuries
 *   gathered from his works  Ibn al-Qayyim, whose tafsir is scattered through
 *                            his books and collected here
 *   transmitted reports      al-Durr al-manthūr — al-Suyūṭī
 *   general                  Fatḥ al-qadīr — al-Shawkānī, who joins narration
 *                            and reasoning
 *   language and rhetoric    al-Taḥrīr wa-l-tanwīr — Ibn ʿĀshūr
 *   the Qurʾan by the Qurʾan  Aḍwāʾ al-bayān — al-Shinqīṭī
 *   contemporary             Ibn ʿUthaymīn
 *
 * The four mother works and Ibn ʿUthaymīn were the site owner's choice; the
 * rest were chosen to that brief.
 *
 * And two short works stand in front of them — al-Mukhtaṣar and al-Jalālayn —
 * for a different reason: they are the two whose English the site also has, so
 * holding their Arabic lets a reader pass between the languages of one work.
 *
 * The list is `tafsirWorks.json`, beside this file, because two things read
 * it: this module, and the script that copies the works named in it. It is in
 * the order it is shown in — the short works, the mother works, then the
 * others, each group earliest author first — and adding or dropping a work is
 * adding or dropping its line.
 */
export const TAFSIR_APP_WORKS = works as TafsirAppWork[];

export function tafsirAppWork(id: string): TafsirAppWork | undefined {
  return TAFSIR_APP_WORKS.find((w) => w.id === id);
}

/** "Fakhr al-Dīn al-Rāzī (d. 606 AH)", as the works from the corpus are credited. */
export function tafsirAppAuthor(work: TafsirAppWork): string {
  if (work.credit) return work.credit;
  return work.died === null ? work.author : `${work.author} (d. ${work.died} AH)`;
}

/** This ayah on tafsir.app, where every work it holds can be opened on it. */
export function tafsirAppAyahUrl(verseKey: string): string {
  const [surah, ayah] = verseKey.split(":");
  return `${TAFSIR_APP.href}/${surah}/${ayah}`;
}

/** This ayah, in this work, on tafsir.app. */
export function tafsirAppUrl(id: string, verseKey: string): string {
  const [surah, ayah] = verseKey.split(":");
  return `${TAFSIR_APP.href}/${id}/${surah}/${ayah}`;
}

// ── what can be read here ───────────────────────────────────────────────────

interface MirrorRecord {
  passages: number;
  ayat: number;
  bytes: number;
  mirroredAt: string;
}

const MIRRORED = (mirror as { works?: Record<string, MirrorRecord> }).works ?? {};

/** Where this site's own copy is served from. */
const HOME = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/tafsir`;

/** Where passages that are not copied are fetched from, if anywhere. */
const RELAY = (process.env.NEXT_PUBLIC_TAFSIR_APP_BASE ?? "").trim().replace(/\/*$/, "");

/** Whether this site holds its own copy of the work. */
export function tafsirAppMirrored(id: string): boolean {
  return id in MIRRORED;
}

/** Whether the work's text can be shown in the panel, or only linked to. */
export function tafsirAppReadable(id: string): boolean {
  return tafsirAppMirrored(id) || RELAY !== "";
}

/** How many of the works can be read in the panel in this build. */
export const TAFSIR_APP_READABLE_COUNT = TAFSIR_APP_WORKS.filter((w) => tafsirAppReadable(w.id)).length;

/** …and how many of those are this site's own copy. */
export const TAFSIR_APP_MIRRORED_COUNT = TAFSIR_APP_WORKS.filter((w) => tafsirAppMirrored(w.id)).length;

// ── a passage ───────────────────────────────────────────────────────────────

export interface TafsirAppPassage {
  paras: Para[];
  /**
   * The ayat the passage is the author's treatment of, both inclusive. Often
   * one; often not. Ibn ʿĀshūr takes the first fourteen ayat of al-Takwīr
   * together, and the panel should say so rather than present his fourteen as
   * a comment on one.
   */
  from: number;
  to: number;
}

/**
 * An editor's footnote, as it stands in a passage: `[[في المطبوعة: …]]`.
 * Splitting a paragraph on this leaves the notes as the odd-numbered pieces.
 */
export const EDITOR_NOTE = /\[\[(.*?)\]\]/g;

/** A rule the edition sets between two sections of a long passage. */
export const SECTION_BREAK = "* * *";

/**
 * The works in which a short line opening with an asterisk is a heading. It is
 * not so everywhere, which is why they are named: in al-Ṭabarī such a line is
 * a hemistich of poetry, and in Ibn ʿUthaymīn's transcribed lessons it is
 * whoever is speaking.
 */
const STARRED_HEADINGS = new Set(["mukhtasar", "zad-almaseer", "ibn-alqayyim", "adwaa-albayan"]);

/**
 * A passage is kept as plain text, one paragraph to a line, and none of its
 * words are touched. Two things are done to it, both to the edition's
 * apparatus rather than to the author:
 *
 *   - `(p-١٧)`, which marks where a page of the printed edition begins, is
 *     taken out. It is a place in a book the reader is not holding.
 *   - `[[…]]`, which is the editor's footnote — Shākir's on al-Ṭabarī, a
 *     variant reading on Ibn Kathīr — is left exactly where it stands, still
 *     in its brackets, for the panel to set apart from the author's own words.
 *     See `EDITOR_NOTE`.
 *
 * And the headings are read out of it. Al-Ṭabarī's own, "القول في تأويل قوله
 * تعالى", opens each of his sections and is set as the heading it is. And in
 * some works the edition marks a heading with an asterisk before it — "* فصل",
 * "* التفسير:" — which is the edition's mark and not the author's word, so the
 * line is set as a heading and the mark left out. See `STARRED_HEADINGS`.
 *
 * This is done as the passage is read, not as it is copied: the copy on disk
 * is exactly what tafsir.app served.
 */
function paragraphs(text: string, id: string): Para[] {
  const starred = STARRED_HEADINGS.has(id);
  return text
    .replace(/\(p-[\d٠-٩]+\)/g, "")
    // A long footnote runs over several lines. It is one note, and is kept on
    // one line so that cutting the passage into paragraphs does not cut it in
    // two and leave each half looking like the author's own words.
    .replace(/\[\[[\s\S]{0,4000}?\]\]/g, (note) => note.replace(/\s*\n+\s*/g, " "))
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      starred && /^\* (?!\*)/.test(line) && line.length <= 120
        ? { text: line.slice(2), heading: true, rtl: true }
        : { text: line, heading: /^القول في تأويل/.test(line), rtl: true },
    );
}

// ── reading this site's own copy ────────────────────────────────────────────

/** A stored passage: the ayat it covers, and its text. */
type Stored = [from: number, to: number, text: string];

interface WorkIndex {
  /** For each surah, the ayah each of its files begins at, in order. */
  surahs: Record<string, number[]>;
}

/**
 * Files already asked for, kept as the asking rather than the answer so that
 * two works opened at once on one ayah do not fetch the same index twice. They
 * are static files of this site, so across visits the browser's own cache
 * holds them; this is only for the session, and it is kept short — a file is
 * a few hundred kilobytes of text and a long sitting opens many.
 */
const files = new Map<string, Promise<unknown>>();
const FILES_KEPT = 48;

function file<T>(url: string): Promise<T> {
  const asked = files.get(url);
  if (asked) return asked as Promise<T>;
  const asking = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return res.json() as Promise<T>;
  });
  files.set(url, asking);
  // A failure is forgotten, so the next attempt asks again.
  asking.catch(() => files.delete(url));
  if (files.size > FILES_KEPT) files.delete(files.keys().next().value as string);
  return asking;
}

async function fromMirror(id: string, surah: number, ayah: number): Promise<TafsirAppPassage> {
  const nothing: TafsirAppPassage = { paras: [], from: ayah, to: ayah };
  const index = await file<WorkIndex>(`${HOME}/${id}/index.json`);

  // The file holding an ayah's passage is the last one to begin at or before it.
  const first = (index.surahs[String(surah)] ?? []).filter((start) => start <= ayah).pop();
  if (first === undefined) return nothing;

  const part = await file<{ passages: Stored[] }>(`${HOME}/${id}/${surah}-${first}.json`);
  const found = part.passages.find(([from, to]) => from <= ayah && ayah <= to);
  return found ? { paras: paragraphs(found[2], id), from: found[0], to: found[1] } : nothing;
}

// ── reading through a relay ─────────────────────────────────────────────────

interface Served {
  data?: string;
  ayahs_start?: number;
  count?: number;
}

/** Bumping this invalidates every passage cached from the relay at once. */
const CACHE_VERSION = "mishkat-tafsirapp-v1";

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

async function fromRelay(id: string, surah: number, ayah: number): Promise<TafsirAppPassage> {
  const url = `${RELAY}/get.php?src=${encodeURIComponent(id)}&s=${surah}&a=${ayah}&ver=1`;

  // A tafsir written centuries ago does not change, so an answer is kept across
  // sessions — and a passage read twice is asked of tafsir.app once.
  const store = await openCache();
  let served = (await (await store?.match(url))?.json()) as Served | undefined;
  if (!served) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`tafsir.app responded ${res.status} for ${id} ${surah}:${ayah}`);
    if (store) {
      try {
        await store.put(url, res.clone());
      } catch {
        /* quota, private mode — the passage is still shown */
      }
    }
    served = (await res.json()) as Served;
  }

  // A run of ayat taken together says where it begins and how many more it takes in.
  const start = Number.isInteger(served.ayahs_start) ? (served.ayahs_start as number) : ayah;
  const more = Number.isInteger(served.count) ? Math.max(0, served.count as number) : 0;
  return {
    paras: paragraphs(served.data ?? "", id),
    from: Math.min(start, ayah),
    to: Math.max(ayah, start + more),
  };
}

/**
 * One work's passage on one ayah, from this site's copy if it has one and
 * through the relay if not.
 *
 * Throws when the work can only be linked to, or the fetch fails. An empty
 * passage is an answer, not a failure: the work has nothing on the ayah.
 */
export async function fetchTafsirApp(id: string, verseKey: string): Promise<TafsirAppPassage> {
  const [surah, ayah] = verseKey.split(":").map(Number);
  if (tafsirAppMirrored(id)) return fromMirror(id, surah, ayah);
  if (RELAY) return fromRelay(id, surah, ayah);
  throw new Error(`${id} is linked to, not read from, in this build`);
}

/**
 * What tafsir.app says about a work: the author's own account of what he set
 * out to do, and what later scholars said of the result. Copied with the work,
 * so it is there for the works this site holds and for no others.
 *
 * It is written as a list of headed quotations — `* قال المؤلف في المقدمة:` —
 * and the headings are read as headings.
 */
export async function fetchTafsirAppAbout(id: string): Promise<Para[]> {
  if (!tafsirAppMirrored(id)) return [];
  const about = await file<{ text?: string }>(`${HOME}/${id}/about.json`).catch(() => null);
  return (about?.text ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith("* ")
        ? { text: line.slice(2).replace(/[:：]\s*$/, ""), heading: true, rtl: true }
        : { text: line, heading: false, rtl: true },
    );
}
