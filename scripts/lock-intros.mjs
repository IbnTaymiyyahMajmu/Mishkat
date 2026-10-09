/**
 * Holds the surah introductions to their sources.
 *
 * An introduction (`src/content/intros/<n>.json`) says three kinds of thing:
 * what is counted, what a scholar said, and what was written for this site.
 * This script is what keeps the second kind honest, and the third kind in
 * shape.
 *
 *   node scripts/lock-intros.mjs            (npm run lock:intros)
 *   node scripts/lock-intros.mjs --check    (npm run check:intros)
 *
 * **Quotations.** Every `evidence` entry names a work this site holds a copy
 * of, an ayah, and some words. The words are looked for in that work's passage
 * on that ayah — by their letters alone, so that a quotation typed without its
 * vowels still finds itself — and are then *replaced by the copy's own text*:
 * its vocalisation, its spelling, its punctuation. What the page prints is
 * therefore what the book says, not what somebody remembered it saying. A
 * quotation that cannot be found is an error, and nothing is written.
 *
 * **Aims.** al-Mukhtaṣar fī al-Tafsīr opens each surah by stating what the
 * surah is for — من مقاصد السورة. Those 114 sentences are lifted out of the
 * copy into `src/content/surah-aims.json`, so that the Arabic of an aim is
 * never typed either.
 *
 * **The list.** Which surahs have an introduction at all is written to
 * `src/content/intros-written.json`, a line of numbers.
 *
 * **Shape.** The map of a surah must run from its first ayah to its last with
 * nothing missing and nothing twice; every ayah an introduction points at must
 * exist; a hadith must say where it is recorded and how it is graded.
 *
 * `--check` changes nothing and fails if anything would change. The deploy
 * runs it, so an introduction that has drifted from its sources is not
 * published.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const CHECK = process.argv.includes("--check");
const ROOT = new URL("../", import.meta.url);
const INTROS = new URL("src/content/intros/", ROOT);
const AIMS = new URL("src/content/surah-aims.json", ROOT);
const WRITTEN = new URL("src/content/intros-written.json", ROOT);
const MIRROR = new URL("public/tafsir/", ROOT);

// ── what is counted ─────────────────────────────────────────────────────────

const factsFile = await readFile(new URL("src/lib/quran/surahFacts.ts", ROOT), "utf8");
const FACTS = [...factsFile.matchAll(/\{ revealed: (\d+), place: "(\w+)", ayat: (\d+),/g)].map((m) => ({
  place: m[2],
  ayat: Number(m[3]),
}));
if (FACTS.length !== 114) throw new Error(`surahFacts.ts has ${FACTS.length} surahs; run npm run gen:facts`);

// ── reading the copy ────────────────────────────────────────────────────────

const indexes = new Map();
const files = new Map();

async function json(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

/** The passage of a work that covers an ayah, as the copy holds it. */
async function passage(work, surah, ayah) {
  if (!indexes.has(work)) {
    const url = new URL(`${work}/index.json`, MIRROR);
    indexes.set(work, existsSync(url) ? (await json(url)).surahs : null);
  }
  const starts = indexes.get(work)?.[String(surah)];
  if (!starts) return null;
  const start = [...starts].reverse().find((s) => s <= ayah) ?? starts[0];
  const name = `${work}/${surah}-${start}.json`;
  if (!files.has(name)) files.set(name, (await json(new URL(name, MIRROR))).passages);
  return files.get(name).find((p) => p[0] <= ayah && ayah <= p[1])?.[2] ?? null;
}

// ── finding words by their letters ──────────────────────────────────────────

const LETTER = /[\p{L}\p{N}]/u;
/** Vowel marks, the dagger alif, Qur'anic annotation signs, and tatweel. */
const MARK = /[ً-ٰٟۖ-ۭـ]/;
const FOLD = { "آ": "ا", "أ": "ا", "إ": "ا", "ٱ": "ا", "ى": "ي", "ی": "ي", "ک": "ك" };

/**
 * The letters of a text, each remembering where in the text it stood. What an
 * editor added is passed over — a footnote `[[…]]`, a page mark `(p-٢٦٤)` —
 * so words either side of one are still next to each other.
 */
function letters(text) {
  const chars = [];
  const at = [];
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("[[", i)) {
      const end = text.indexOf("]]", i);
      if (end > 0) {
        i = end + 1;
        continue;
      }
    }
    if (text.startsWith("(p-", i)) {
      const end = text.indexOf(")", i);
      if (end > 0 && end - i < 12) {
        i = end;
        continue;
      }
    }
    const c = text[i];
    if (MARK.test(c) || !LETTER.test(c)) continue;
    chars.push(FOLD[c] ?? c);
    at.push(i);
  }
  return { chars: chars.join(""), at };
}

/** The copy's own text for a quotation, or null if the copy does not say it. */
function locked(quote, source, least = 8) {
  const want = letters(quote).chars;
  if (want.length < least) return null;
  const have = letters(source);
  const found = have.chars.indexOf(want);
  if (found < 0) return null;
  let end = have.at[found + want.length - 1] + 1;
  while (end < source.length && MARK.test(source[end])) end++;
  return source
    .slice(have.at[found], end)
    .replace(/\[\[[\s\S]*?\]\]/g, "")
    .replace(/\(p-[^)]{0,9}\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── the aims ────────────────────────────────────────────────────────────────

const aims = [];
for (let surah = 1; surah <= 114; surah++) {
  const text = await passage("mukhtasar", surah, 1);
  const found = text && /\*[^\n]*\n\*[^\n]*قاصِ?د[^\n]*\n([\s\S]*?)\n\*/.exec(text);
  if (!found) throw new Error(`al-Mukhtaṣar states no aim for surah ${surah} in the copy`);
  aims.push(found[1].replace(/\s+/g, " ").trim());
}
const aimsFile = JSON.stringify(aims, null, 2) + "\n";
const aimsNow = existsSync(AIMS) ? await readFile(AIMS, "utf8") : "";

// ── the introductions ───────────────────────────────────────────────────────

/**
 * The works an introduction may quote: scholars of Ahl al-Sunnah, and no one
 * else. The copy holds other works as well; they are left out of this list on
 * purpose, and a quotation from one of them is an error. The reasons, work by
 * work, are in src/content/README.md.
 */
const QUOTABLE = new Set([
  "mukhtasar",
  "tabari",
  "baghawi",
  "ibn-katheer",
  "ibn-alqayyim",
  "zad-almaseer",
  "aldur-almanthoor",
  "fath-alqadeer",
  "adwaa-albayan",
  "ibn-uthaymeen",
  "qurtubi",
]);

/** How a report stands — `Rank` in src/lib/intros/types.ts. */
const RANKS = ["agreed", "sahih", "hasan", "companion", "disputed", "reported"];
/** How a source line says a report is in one of the two Ṣaḥīḥs. */
const IN_THE_TWO = ["al-Bukhārī (", "Muslim (", "al-Bukhārī and Muslim", "Ṣaḥīḥ al-Bukhārī", "Ṣaḥīḥ Muslim"];

const PLACES = ["makkah", "madinah", "disputed"];
const PERIODS = ["makkah-early", "makkah-middle", "makkah-late", "madinah-early", "madinah-middle", "madinah-late"];

const errors = [];
const notes = [];
let changed = 0;
let quotes = 0;

const names = existsSync(INTROS) ? (await readdir(INTROS)).filter((n) => n.endsWith(".json")) : [];
const written = [];

for (const name of names.sort((a, b) => parseInt(a) - parseInt(b))) {
  const url = new URL(name, INTROS);
  const raw = await readFile(url, "utf8");
  const where = `intros/${name}`;
  const bad = (message) => errors.push(`${where}: ${message}`);

  let intro;
  try {
    intro = JSON.parse(raw);
  } catch (error) {
    bad(`is not JSON — ${error.message}`);
    continue;
  }

  const surah = intro.surah;
  if (name !== `${surah}.json` || !FACTS[surah - 1]) {
    bad(`says it is surah ${surah}`);
    continue;
  }
  written.push(surah);
  const { ayat, place } = FACTS[surah - 1];
  const inSurah = (n) => Number.isInteger(n) && n >= 1 && n <= ayat;
  const text = (value) => typeof value === "string" && value.trim().length > 0;

  for (const key of ["epithet", "lede", "aim"]) if (!text(intro[key])) bad(`has no ${key}`);
  if (text(intro.epithet) && intro.epithet.length > 70) bad(`epithet runs to ${intro.epithet.length} characters; 70 at most`);
  if (text(intro.lede) && intro.lede.length > 460) bad(`lede runs to ${intro.lede.length} characters; 460 at most`);

  if (!Array.isArray(intro.names) || intro.names.length === 0) bad("gives no name");
  for (const n of intro.names ?? []) {
    if (!text(n.arabic) || !text(n.name) || !text(n.meaning)) bad(`a name is missing its Arabic, its Latin form or its meaning`);
  }

  const r = intro.revelation ?? {};
  if (!PLACES.includes(r.place)) bad(`revelation.place is ${JSON.stringify(r.place)}`);
  if (!PERIODS.includes(r.period)) bad(`revelation.period is ${JSON.stringify(r.period)}`);
  for (const key of ["verdict", "detail", "when"]) if (!text(r[key])) bad(`has no revelation.${key}`);
  if (r.place !== "disputed" && PERIODS.includes(r.period) && !r.period.startsWith(r.place)) {
    bad(`is placed in ${r.place} but dated ${r.period}`);
  }
  if (r.place !== "disputed" && PLACES.includes(r.place) && r.place !== place) {
    notes.push(`${where}: placed in ${r.place}; the muṣḥaf's heading has ${place}`);
  }
  if (!Array.isArray(r.evidence) || r.evidence.length === 0) notes.push(`${where}: no quotation on where it was revealed`);

  if (!Array.isArray(intro.setting) || !intro.setting.every(text) || intro.setting.length === 0) bad("has no setting");
  if (!Array.isArray(intro.themes) || intro.themes.length < 2) bad("has fewer than two themes");
  if (!Array.isArray(intro.sources) || intro.sources.length === 0) bad("names no sources");

  // The map: every ayah once.
  let next = 1;
  for (const p of intro.outline ?? []) {
    if (p.from !== next) bad(`the outline reaches ayah ${next - 1} and then begins again at ${p.from}`);
    if (!(p.to >= p.from)) bad(`the passage from ${p.from} ends at ${p.to}`);
    if (!text(p.title) || !text(p.summary)) bad(`the passage from ${p.from} has no title or no summary`);
    next = p.to + 1;
  }
  if (next !== ayat + 1) bad(`the outline ends at ayah ${next - 1}; the surah has ${ayat}`);

  for (const o of intro.occasions ?? []) {
    if (!text(o.title) || !text(o.text) || !text(o.source)) bad(`an occasion is missing its title, text or source`);
    if (o.story !== undefined && !(Array.isArray(o.story) && o.story.length && o.story.every(text))) {
      bad(`the occasion “${o.title}” has a story that is not paragraphs of writing`);
    }
    if (o.caveat !== undefined && !(text(o.caveat) && o.caveat.length >= 20)) bad(`the occasion “${o.title}” has a caveat that says nothing`);
    if (o.ayat && !(inSurah(o.ayat[0]) && inSurah(o.ayat[1]) && o.ayat[0] <= o.ayat[1])) bad(`an occasion is about ayat ${o.ayat}`);
    // Nothing is called ṣaḥīḥ on the strength of a guess: an occasion ranked
    // as being in the two Ṣaḥīḥs has to say which of them it is in.
    if (!RANKS.includes(o.rank)) bad(`the occasion “${o.title}” does not say how it stands`);
    else if (o.rank === "agreed" && !IN_THE_TWO.some((mark) => String(o.source).includes(mark))) {
      bad(`the occasion “${o.title}” is ranked as in the two Ṣaḥīḥs, and its source names neither`);
    }
  }
  for (const v of intro.virtues ?? []) {
    const inTheTwo = (v.refs ?? []).some((ref) => ref.book === "bukhari" || ref.book === "muslim");
    if (!RANKS.includes(v.rank)) bad(`a narration (${v.source}) does not say how it stands`);
    else if ((v.rank === "agreed") !== inTheTwo) bad(`a narration (${v.source}) is ranked ${v.rank}, which its references do not bear out`);
    if (!text(v.text) || !text(v.source) || !text(v.grade)) bad(`a narration is missing its text, source or grade`);
    if (v.caveat !== undefined && !(text(v.caveat) && v.caveat.length >= 20)) bad(`a narration (${v.source}) has a caveat that says nothing`);
    for (const ref of v.refs ?? []) if (!text(ref.book) || !text(ref.number)) bad(`a narration has a reference without a book or a number`);
  }
  for (const n of intro.notable ?? []) {
    if (!inSurah(n.ayah) || (n.to !== undefined && !(inSurah(n.to) && n.to > n.ayah))) bad(`a notable ayah is ${n.ayah}${n.to ? `–${n.to}` : ""}`);
    if (!text(n.label)) bad(`notable ayah ${n.ayah} has no label`);
  }
  if (intro.keyAyah && (!inSurah(intro.keyAyah.ayah) || !text(intro.keyAyah.why))) bad(`the key ayah is ${intro.keyAyah.ayah}`);

  // Every "18:28" in the prose is an ayah that exists.
  for (const [, s, a] of JSON.stringify({ ...intro, revelation: { ...r, evidence: [] } }).matchAll(/(?<![\d:.])(\d{1,3}):(\d{1,3})(?![\d:])/g)) {
    const row = FACTS[Number(s) - 1];
    if (!row || Number(a) < 1 || Number(a) > row.ayat) bad(`points at ${s}:${a}, which is not an ayah`);
  }

  // A sentence that tells of a report which is not ṣaḥīḥ ends with a mark of
  // how the report stands — `{reported}`, `{disputed}`, `{hasan}` — and only
  // the account of the surah carries them.
  //
  // A date or a figure that is not certain is followed by `{?why it is not}`;
  // the page shows a small sign there, and the reason to whoever rests on it.
  const marked = [r.detail, r.when, ...(intro.setting ?? [])].join(" ");
  for (const [, word] of marked.matchAll(/[{]([^}]*)[}]/g)) {
    if (word.startsWith("?")) {
      if (word.length < 20) bad(`a doubt is marked without saying why: {${word}}`);
    } else if (word !== "weak" && !["hasan", "disputed", "reported"].includes(word)) {
      bad(`a sentence is marked {${word}}, which is not a standing`);
    }
  }
  const unmarked = JSON.stringify({ ...intro, setting: [], revelation: { ...r, detail: "", when: "" } });
  if (/[{]([?]|hasan[}]|disputed[}]|weak[}]|reported[}])/.test(unmarked)) bad("a mark stands outside the account of the surah");
  // Weak and fabricated reports are neither given nor mentioned.
  if ((intro.occasions ?? []).some((o) => o.rank === "weak") || (intro.virtues ?? []).some((v) => v.rank === "weak")) {
    bad("gives a report ranked weak; a weak report is left out, not marked");
  }
  if (marked.includes("{weak}")) bad("tells of a report marked {weak}; a weak report is left out, not marked");

  // The quotations, held to the copy.
  const everyQuote = [
    ...(r.evidence ?? []).map((e) => ({ e, surah })),
    // A heading can be two words long — "هي مكية" — and is still what the book says.
    ...(r.attested ?? []).map((e) => ({ e, surah, least: 6 })),
    ...(intro.occasions ?? []).flatMap((o) => (o.evidence ? [{ e: o.evidence, surah }] : [])),
    ...(intro.virtues ?? []).flatMap((v) => (v.evidence ? [{ e: v.evidence, surah }] : [])),
  ];
  for (const e of r.attested ?? []) if (!text(e.says)) bad(`an attestation from ${e.work} does not say what it says`);
  for (const { e, least } of everyQuote) {
    quotes++;
    if (!QUOTABLE.has(e.work)) {
      bad(`quotes ${e.work}, which is not among the works an introduction may quote`);
      continue;
    }
    const source = await passage(e.work, surah, e.ayah);
    if (source === null) {
      bad(`quotes ${e.work} on ayah ${e.ayah}, which the copy does not hold`);
      continue;
    }
    const exact = locked(e.quote ?? "", source, least);
    if (exact === null) {
      bad(`${e.work} on ayah ${e.ayah} does not say: ${String(e.quote).slice(0, 70)}…`);
      continue;
    }
    e.quote = exact;
  }

  const out = JSON.stringify(intro, null, 2) + "\n";
  if (out !== raw) {
    changed++;
    if (CHECK) bad("is not locked to its sources — run npm run lock:intros");
    else if (!errors.some((line) => line.startsWith(where))) await writeFile(url, out, "utf8");
  }
}

// ── saying what was found ───────────────────────────────────────────────────

for (const line of notes) console.log(`note   ${line}`);
for (const line of errors) console.log(`wrong  ${line}`);

if (aimsFile !== aimsNow) {
  if (CHECK) {
    console.log("wrong  surah-aims.json is not what al-Mukhtaṣar says — run npm run lock:intros");
    errors.push("aims");
  } else {
    await writeFile(AIMS, aimsFile, "utf8");
    console.log("wrote  the aim of each surah, from al-Mukhtaṣar, to src/content/surah-aims.json");
  }
}

// Which surahs have one: the settings page says how many, without carrying them.
const writtenFile = JSON.stringify(written) + "\n";
if (writtenFile !== (existsSync(WRITTEN) ? await readFile(WRITTEN, "utf8") : "")) {
  if (CHECK) {
    console.log("wrong  intros-written.json is out of date — run npm run lock:intros");
    errors.push("written");
  } else {
    await writeFile(WRITTEN, writtenFile, "utf8");
  }
}

const missing = FACTS.map((_, i) => i + 1).filter((n) => !written.includes(n));
console.log(
  `${written.length} of 114 introductions written, ${quotes} quotations held to the copy` +
    (CHECK ? "" : `, ${changed} files rewritten`) +
    (missing.length ? ` — not yet written: ${missing.join(", ")}` : ""),
);

if (errors.length) {
  console.log(`${errors.length} thing${errors.length === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
