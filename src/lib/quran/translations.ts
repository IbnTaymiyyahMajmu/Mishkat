import { fetchEditions, fetchLanguages, type RawEdition, type RawLanguage } from "./api";
import { DEFAULT_TRANSLATION, TRANSLATIONS } from "./resources";
import { FILED_EDITIONS } from "./translationFiles";

/**
 * The library of translations.
 *
 * The corpus carries some 125 of them, in seventy languages, and lists them as
 * one flat run in no order: Saheeh International between a Kurdish and a
 * Malayalam, "Dutch" and "dutch" as two languages, a transliteration filed as
 * a translation. This file makes a library of that — a shelf to a language,
 * each language under the name its readers call it, the translations a reader
 * is likeliest to have heard of at the head of their shelf — and reads the
 * markup a translation arrives in.
 *
 * One translation is not the corpus's: The Clear Qur'an, which it carried and
 * no longer does, is read from files (`translationFiles.ts`) and stands on
 * its shelf with the rest, marked as coming from elsewhere.
 *
 * Nothing here is a judgement on a translation. Every one is shown under its
 * translator's name, as published, and where two differ both stand.
 */

export interface Edition {
  id: number;
  /** What it is called under an ayah: `"Mufti Taqi Usmani"`. */
  name: string;
  /** The translator, where the name above is the book's rather than his. */
  author: string;
  /** Which shelf it stands on: `"urdu"`. */
  language: string;
  /** `"ur"`, where the corpus knows it — for hyphenation and for shaping. */
  iso: string;
  /** Read from files rather than from the corpus, and so without footnotes. */
  filed?: boolean;
}

export interface Shelf {
  /** `"urdu"`. */
  key: string;
  /** `"Urdu"`. */
  label: string;
  /** `"اردو"`. Empty where the corpus has no name for it but the English. */
  native: string;
  iso: string;
  editions: Edition[];
}

export interface Catalogue {
  shelves: Shelf[];
  byId: Map<number, Edition>;
  /** What to read when what was chosen is no longer offered. */
  fallback: number;
}

/** Filed among the translations, and is not one: the Arabic in Latin letters. */
const NOT_TRANSLATIONS = new Set([57]);

/** The corpus's spellings of a language, where it has more than one. */
const SAME_LANGUAGE: Record<string, string> = {
  "yau,yuw": "yao",
  "sinhala, sinhalese": "sinhala",
  "uighur, uyghur": "uyghur",
  "divehi, dhivehi, maldivian": "divehi",
  "central khmer": "khmer",
  azeri: "azerbaijani",
};

function languageKey(raw: string): string {
  const name = raw.trim().toLowerCase();
  return SAME_LANGUAGE[name] ?? name.split(",")[0].trim();
}

function titleCase(key: string): string {
  return key.replace(/(^|[\s-])(\p{L})/gu, (_, gap: string, letter: string) => gap + letter.toUpperCase());
}

/**
 * A translator's name, tidied. The corpus files several under the name of the
 * book with the translator in a second field, and some with stray spaces
 * before a bracket; where the two fields say the same thing it is said once.
 */
function build(raw: RawEdition, iso: string): Edition {
  const known = TRANSLATIONS.find((t) => t.id === raw.id);
  const name = (known?.label ?? raw.name ?? "").replace(/\s*\(\s*/g, " (").replace(/\s+/g, " ").trim();
  const author = (raw.author_name ?? "").replace(/\s+/g, " ").trim();
  const said = (s: string) => s.toLowerCase().replace(/[^\p{L}]+/gu, "");
  const repeats = !author || said(name).includes(said(author)) || said(author).includes(said(name));
  return { id: raw.id, name, author: known || repeats ? "" : author, language: languageKey(raw.language_name), iso };
}

function assemble(editions: RawEdition[], languages: RawLanguage[]): Catalogue {
  const spoken = new Map<string, RawLanguage>();
  for (const l of languages) spoken.set(languageKey(l.name), l);

  const shelves = new Map<string, Shelf>();
  const byId = new Map<number, Edition>();

  const shelve = (edition: Edition) => {
    const key = edition.language;
    const language = spoken.get(key);
    byId.set(edition.id, edition);

    let shelf = shelves.get(key);
    if (!shelf) {
      const native = (language?.native_name ?? "").trim();
      const label = titleCase(key);
      shelf = {
        key,
        label,
        // Said once where a language's own name for itself is the English one.
        native: native && native.toLowerCase() !== label.toLowerCase() ? native : "",
        iso: language?.iso_code ?? "",
        editions: [],
      };
      shelves.set(key, shelf);
    }
    shelf.editions.push(edition);
  };

  // The files are the source for what they hold: if the corpus should list one
  // of them again, it is still read from where this site reads it.
  const filed = new Set(FILED_EDITIONS.map((e) => e.id));
  for (const raw of editions) {
    if (NOT_TRANSLATIONS.has(raw.id) || filed.has(raw.id)) continue;
    shelve(build(raw, spoken.get(languageKey(raw.language_name))?.iso_code ?? ""));
  }
  for (const e of FILED_EDITIONS) {
    shelve({ id: e.id, name: e.name, author: "", language: e.language, iso: e.iso, filed: true });
  }

  // The ones a reader is likeliest to know lead their shelf, in the order this
  // build names them; the rest follow by name.
  const lead = (id: number) => {
    const at = TRANSLATIONS.findIndex((t) => t.id === id);
    return at === -1 ? TRANSLATIONS.length : at;
  };
  for (const shelf of shelves.values()) {
    shelf.editions.sort((a, b) => lead(a.id) - lead(b.id) || a.name.localeCompare(b.name));
  }

  const sorted = [...shelves.values()].sort((a, b) => a.label.localeCompare(b.label));
  const english = sorted.find((s) => s.key === "english");
  return {
    shelves: sorted,
    byId,
    fallback: byId.has(DEFAULT_TRANSLATION)
      ? DEFAULT_TRANSLATION
      : (english?.editions[0]?.id ?? sorted[0]?.editions[0]?.id ?? DEFAULT_TRANSLATION),
  };
}

let held: Catalogue | null = null;
let asking: Promise<Catalogue> | null = null;

/**
 * The catalogue, asked for once a session and kept by the corpus client for a
 * week. A failure is not kept: the next asker asks again.
 *
 * The languages are a second answer and a lesser one — a language's name for
 * itself — so the library is not held up for them, and is not lost with them.
 */
export function loadCatalogue(): Promise<Catalogue> {
  if (held) return Promise.resolve(held);
  asking ??= Promise.all([fetchEditions(), fetchLanguages().catch(() => [] as RawLanguage[])])
    .then(([editions, languages]) => {
      if (!editions.length) throw new Error("The corpus listed no translations");
      held = assemble(editions, languages);
      return held;
    })
    .finally(() => {
      asking = null;
    });
  return asking;
}

/** The catalogue if it has already arrived, without asking for it. */
export function heldCatalogue(): Catalogue | null {
  return held;
}

/**
 * What a translation is called, as far as is known without asking: by the
 * catalogue if it is here, by this build's own short list if it is not.
 */
export function translationName(id: number): string {
  return (
    held?.byId.get(id)?.name ??
    FILED_EDITIONS.find((e) => e.id === id)?.name ??
    TRANSLATIONS.find((t) => t.id === id)?.label ??
    ""
  );
}

/** `"en"` for the translations this build knows to be English; else unknown. */
export function translationLanguage(id: number): string {
  return (
    held?.byId.get(id)?.iso ??
    FILED_EDITIONS.find((e) => e.id === id)?.iso ??
    (TRANSLATIONS.some((t) => t.id === id) ? "en" : "")
  );
}

/**
 * The shelves in the order this reader should meet them: the languages their
 * own browser says they read, then the ones they already keep a translation
 * in, then English, then everything else by name.
 */
export function shelvesFor(catalogue: Catalogue, kept: number[], preferred: readonly string[]): Shelf[] {
  const rank = new Map<string, number>();
  const put = (key: string | undefined) => {
    if (key && !rank.has(key)) rank.set(key, rank.size);
  };
  for (const tag of preferred) {
    const iso = tag.toLowerCase().split("-")[0];
    put(catalogue.shelves.find((s) => s.iso.toLowerCase() === iso)?.key);
  }
  for (const id of kept) put(catalogue.byId.get(id)?.language);
  put("english");
  return [...catalogue.shelves].sort(
    (a, b) => (rank.get(a.key) ?? Infinity) - (rank.get(b.key) ?? Infinity) || a.label.localeCompare(b.label),
  );
}

// ── the text of a translation ───────────────────────────────────────────────

/**
 * A translation, taken apart into what it is made of.
 *
 * It arrives as a string with markup in it, and the markup means things:
 *
 *   `<sup foot_note=195937>2</sup>`       a footnote, and which one
 *   `<i class="s">(existence of) </i>`    words the translator supplied
 *   `<a class="sup"><sup>sg </sup></a>`   a mark that is not a footnote —
 *                                         Bridges' "you" in the singular
 *   `<span class="h">…</span>`            a phrase read differently in another
 *                                         qirāʾa, with a note saying how
 *
 * The site used to cut all of it out, and the footnotes with it. It is read
 * instead, into pieces that are set as what they are. It is never handed to
 * the page as markup: a translation is somebody else's text from somebody
 * else's server, and what the page is given is words.
 */
export type Piece =
  | { kind: "text"; text: string; supplied: boolean }
  | { kind: "note"; id: string; mark: string }
  | { kind: "mark"; text: string };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== "#") return ENTITIES[name.toLowerCase()] ?? whole;
    const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

const TAG = /<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi;

export function parseTranslation(html: string | null | undefined): Piece[] {
  const pieces: Piece[] = [];
  if (!html) return pieces;

  let supplied = 0;
  /** Inside a raised mark: its footnote id if it has one, and what it says. */
  let raised: { id: string; text: string } | null = null;

  const say = (raw: string) => {
    const text = decode(raw).replace(/\s+/g, " ");
    if (!text) return;
    if (raised) {
      raised.text += text;
      return;
    }
    const last = pieces[pieces.length - 1];
    if (last?.kind === "text" && last.supplied === supplied > 0) last.text += text;
    else pieces.push({ kind: "text", text, supplied: supplied > 0 });
  };

  let at = 0;
  for (const tag of html.matchAll(TAG)) {
    say(html.slice(at, tag.index));
    at = (tag.index ?? 0) + tag[0].length;

    const closing = tag[1] === "/";
    const name = tag[2].toLowerCase();
    if (name === "sup") {
      if (!closing) {
        raised = { id: /foot_note\s*=\s*["']?(\d+)/i.exec(tag[3])?.[1] ?? "", text: "" };
      } else if (raised) {
        const mark = raised.text.trim();
        if (raised.id) pieces.push({ kind: "note", id: raised.id, mark: mark || "*" });
        else if (mark) pieces.push({ kind: "mark", text: mark });
        raised = null;
      }
    } else if (name === "i" || name === "em") {
      supplied = Math.max(0, supplied + (closing ? -1 : 1));
    } else if (name === "br" || name === "p") {
      say(" ");
    }
  }
  say(html.slice(at));

  // The ends are trimmed, and a space is not left stranded on either side of a
  // mark — "prayer, ¹ and" should not open a gap the translator did not write.
  const first = pieces[0];
  if (first?.kind === "text") first.text = first.text.trimStart();
  const last = pieces[pieces.length - 1];
  if (last?.kind === "text") last.text = last.text.trimEnd();
  return pieces.filter((p) => p.kind !== "text" || p.text);
}

/** Hebrew, Arabic, Syriac, Thaana and N'Ko, and the Arabic presentation forms. */
const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/;

/**
 * Whether a translation is written right to left, read off its first letter —
 * which is how a browser decides for `dir="auto"`, and is asked here so that
 * the face and the measure can follow the script as well as the direction.
 * The language is not what is asked: the corpus has Urdu in Latin letters.
 */
export function readsRightToLeft(pieces: Piece[]): boolean {
  for (const p of pieces) {
    if (p.kind !== "text") continue;
    const letter = /\p{L}/u.exec(p.text);
    if (letter) return RTL_LETTER.test(letter[0]);
  }
  return false;
}

/** A footnote, or anything else that arrives marked up, as words alone. */
export function plainNote(html: string | null | undefined): string {
  return parseTranslation(html)
    .map((p) => (p.kind === "text" ? p.text : p.kind === "mark" ? p.text : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
