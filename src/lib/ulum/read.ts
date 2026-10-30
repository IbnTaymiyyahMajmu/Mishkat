import { aligner, bare, quoteSkeleton, type Placed } from "./skeleton";

/**
 * Reading the books of the sciences into the shape the ayah study sets out.
 *
 * Each book on the shelf says what it says about an ayah in its own order and
 * in its own layout — al-Ṣāfī word by word in brackets, then sentence by
 * sentence, then the forms, then the rhetoric; al-Daʿʿās a phrase in its
 * ornate brackets and its office after it; Ibn Abī Ḥātim a phrase of the ayah
 * and then the reports on it, numbered. Everything below is the reading of
 * those layouts and nothing more: the text of every remark is the book's, cut
 * where the book cuts it, and placed on the words it quotes (see
 * `skeleton.ts`). Where the layout is not what was expected, the remark is
 * kept, unplaced, rather than forced onto a word.
 *
 * Pure functions, text in and structure out, so that `scripts/check-ulum.mjs`
 * can run every one of them over the whole Qurʾān and say how much of each
 * book found its words.
 */

/** A book's remark on a word or a phrase, and where in the ayah that is. */
export interface Remark {
  /** The words the book quotes, as it spells them. */
  quote: string;
  /** What it says of them, in its words. */
  text: string;
  /** The editor's footnotes on the remark, `[[…]]` in the copy. */
  notes: string[];
  /** The words quoted, counted from 0 in the run of words given; null where not found. */
  at: Placed | null;
}

/** A sentence and the place al-Ṣāfī gives it in the grammar of the ayah. */
export interface Jumla {
  quote: string;
  /** «لا محلّ لها استئنافيّة», «في محلّ رفع خبر المبتدأ…» — his words. */
  place: string;
  notes: string[];
  at: Placed | null;
  /**
   * Whether it stands on its own in the ayah rather than inside another: a
   * sentence with no place in the iʿrāb that is not a relative clause, the
   * answer to an oath or a condition, or an explanation of what came before.
   */
  main: boolean;
  /** Whether the sentence goes on past the words quoted — «يؤمنون بالغيب..». */
  open: boolean;
}

/** A section of a book under its own heading: «* البلاغة:». */
export interface Section {
  heading: string;
  lines: string[];
}

// ── the edition's apparatus ─────────────────────────────────────────────────

const NOTE = /\[\[([\s\S]{0,4000}?)\]\]/g;
const PAGE = /\(p-[\d٠-٩]+\)/g;

/** The text without its page marks, footnotes kept in their brackets. */
export function clean(text: string): string {
  return text.replace(PAGE, "").replace(/\r/g, "");
}

/** Pull the editor's footnotes out of a stretch of text. */
function withoutNotes(text: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  const rest = text.replace(NOTE, (_, n: string) => {
    notes.push(n.trim().replace(/\s+/g, " "));
    return " ";
  });
  return { text: tidy(rest), notes };
}

/** Spaces and the stray punctuation a cut leaves at either end. */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s،,.:؛]+/u, "")
    .replace(/[\s،,]+$/u, "")
    .trim();
}

/**
 * The sections of a passage under the edition's starred headings — «* الإعراب:»,
 * «* الصرف:» — in order, a heading that comes twice (a passage on several
 * ayat) kept twice. Lines before the first heading are a section of their own
 * with no heading.
 */
export function sections(text: string): Section[] {
  const out: Section[] = [{ heading: "", lines: [] }];
  for (const raw of clean(text).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const h = /^\*\s*([^*:\n]{1,40}?)\s*[:：]\s*(.*)$/u.exec(line);
    if (h && h[1].length <= 30 && !/[«»﴿]/.test(h[1])) {
      out.push({ heading: bare(h[1]).trim(), lines: h[2] ? [h[2]] : [] });
      continue;
    }
    out[out.length - 1].lines.push(line);
  }
  return out.filter((s) => s.heading || s.lines.length);
}

/** Every section whose heading is one of these names, in order. */
function under(all: Section[], ...names: string[]): Section[] {
  return all.filter((s) => names.some((n) => s.heading.startsWith(n)));
}

// ── remarks in round brackets: al-Jadwal, Darwīsh ───────────────────────────

/**
 * Before a bracket, the words that make it a reference to a word already
 * parsed — «متعلّق ب (يشفع)», «نعت ل (المتقين)», «معطوف على (سنة)» — rather
 * than the next word to be parsed.
 */
const REFERS = /(?:^|[\s(])(?:ب|بـ|ل|لـ|على|عن|من|إلى|الى|في|ك|كـ|مثل|أي|تقديره|نحو)\s*$/u;

/**
 * A run of text in which the book parses one thing after another, each in
 * round brackets: «(الله) لفظ الجلالة مبتدأ مرفوع (لا) نافية للجنس…».
 */
export function bracketed(text: string, words: string[]): Remark[] {
  // Footnotes may hold brackets of their own; they are taken out first and put
  // back as notes on whichever remark they stood in.
  const notes: string[] = [];
  const body = clean(text).replace(NOTE, (_, n: string) => {
    notes.push(n);
    return `\u0001${notes.length - 1}\u0001`;
  });
  const align = aligner(words);
  const out: Remark[] = [];
  const re = /\(([^()\n]{1,80})\)/gu;
  let m: RegExpExecArray | null;
  let open: { quote: string; start: number; at: Placed | null } | null = null;
  const close = (end: number) => {
    if (!open) return;
    const chunk = body.slice(open.start, end);
    const own: string[] = [];
    const text = chunk.replace(/\u0001(\d+)\u0001/g, (_, i: string) => {
      own.push(notes[Number(i)].trim().replace(/\s+/g, " "));
      return " ";
    });
    out.push({ quote: open.quote, text: tidy(text), notes: own, at: open.at });
  };
  while ((m = re.exec(body))) {
    const before = body.slice(Math.max(0, m.index - 14), m.index);
    // A bracket that names a word already parsed is part of the remark it is in.
    if (open && REFERS.test(before)) continue;
    // Arabic in brackets that is not a word of the ayah — «(تقديره هو)» — has
    // spaces and words no skeleton of the ayah holds; it too stays in the remark.
    const quote = m[1].trim();
    if (!/[ء-ي]/.test(quote)) continue;
    // A word in brackets that is not found from here on is one already parsed,
    // named again — «خبر المبتدأ (الله)» — and belongs to the remark it is in.
    const at = align.next(quote);
    if (open && !at) continue;
    close(m.index);
    open = { quote, start: m.index + m[0].length, at };
  }
  close(body.length);
  return out;
}

// ── al-Jadwal ───────────────────────────────────────────────────────────────

export interface Jadwal {
  iraab: Remark[];
  jumal: Jumla[];
  sarf: Remark[];
  balagha: string[];
  fawaid: string[];
}

const JUMLA = /^و?\s*جمل[ةه]\s*[:：]?\s*«/u;

/** Whether a sentence stands on its own, by the place al-Ṣāfī gives it. */
function isMain(place: string): boolean {
  const p = bare(place);
  if (!/لا\s*محل/.test(p)) return false;
  // The answer to a vocative is the thing being said. The answer to an oath or
  // a condition belongs to the sentence that asked for it.
  return !/(صلة|جواب(?!\s+النداء)|تفسير)/.test(p);
}

/**
 * A sentence joined to another stands where that one stands: «معطوفة على جملة
 * اكتبوه» is part of the answer «اكتبوه» is part of, not a sentence of its own.
 */
function settle(jumal: Jumla[]) {
  jumal.forEach((j, k) => {
    if (!j.main) return;
    const m = /معطوفة\s+على\s+(?:جملة\s+)?(.+)$/u.exec(bare(j.place));
    if (!m || /استئناف|ابتدائ|النداء/.test(m[1])) return;
    const target = quoteSkeleton(m[1].split(/[.،]/u)[0]);
    if (!target) return;
    for (let i = k - 1; i >= 0; i--) {
      const q = quoteSkeleton(jumal[i].quote);
      if (q && (q.startsWith(target) || target.startsWith(q))) {
        j.main = jumal[i].main;
        return;
      }
    }
  });
}

function readJumla(line: string, words: string[], after: number, before: number): Jumla {
  const { text, notes } = withoutNotes(line);
  const body = text.replace(JUMLA, "");
  // The quotation ends at its closing guillemet — or, where the edition left
  // that out, where the place it is given begins.
  let quote: string;
  let place: string;
  const close = body.indexOf("»");
  if (close >= 0) {
    quote = body.slice(0, close);
    place = body.slice(close + 1);
  } else {
    const at = body.search(/\s(لا\s*محل|في\s*محل)/u);
    quote = at >= 0 ? body.slice(0, at) : body;
    place = at >= 0 ? body.slice(at) : "";
  }
  // «(إذا وما في حيّزها من الشرط والجواب)»: a sentence named by its first word.
  const scope = /^\(?\s*(\S+)\s+وما\s+في\s+حي/u.exec(bare(quote));
  if (scope) quote = scope[1];
  // What he adds to the words of the ayah is not in the ayah: «النداء يأيّها الذين»,
  // «(الشهود) رجل…», and a closing mark set a word early, «دعوا في» محلّ جرّ.
  quote = quote
    .replace(/^النداء\s+/u, "")
    .replace(/^[^(]*\)/u, "")
    .replace(/\([^)]*\)/gu, " ")
    .replace(/^[(\s]+/u, "")
    .trim();
  const spill = /^(.*\S)\s+(في|لا)$/u.exec(quote);
  if (spill) {
    quote = spill[1];
    place = `${spill[2]} ${place}`;
  }
  // «الله .. عليم» gives its first words and its last; where it begins is what can be found.
  const open = /\.{2,}|…/.test(quote);
  quote = (quote.split(/\.{2,}|…/u).find((part) => part.trim()) ?? "").trim();
  place = tidy(place)
    .replace(/\.$/, "")
    .replace(/^.*?(?=(?:لا|في)\s*مح)/u, "");
  // The list goes in the order of the ayah, so a sentence is looked for after
  // the last one, then inside it, which is where a sentence within it stands.
  const align = aligner(words);
  const found = quote ? (align.find(quote, after) ?? align.find(quote, before) ?? align.find(quote, 0)) : null;
  return { quote, place, notes, at: found, main: isMain(place), open };
}

/**
 * Al-Ṣāfī's al-Jadwal: the words parsed, the sentences and their places, the
 * forms, the rhetoric and the benefits — each under its heading.
 */
export function readJadwal(text: string, words: string[]): Jadwal {
  const all = sections(text);
  const iraab: Remark[] = [];
  const jumal: Jumla[] = [];
  for (const s of under(all, "الإعراب", "الاعراب")) {
    const parsing: string[] = [];
    for (const line of s.lines) {
      if (JUMLA.test(line)) {
        const prev = [...jumal].reverse().find((j) => j.at);
        const after = prev?.at ? (prev.open ? prev.at.from + 1 : prev.at.to + 1) : 0;
        jumal.push(readJumla(line, words, after, prev?.at?.from ?? 0));
      } else parsing.push(line);
    }
    iraab.push(...bracketed(parsing.join("\n"), words));
  }
  settle(jumal);
  const sarf: Remark[] = [];
  for (const s of under(all, "الصرف")) sarf.push(...bracketed(s.lines.join("\n"), words));
  return {
    iraab,
    jumal,
    sarf,
    balagha: under(all, "البلاغة").flatMap((s) => s.lines),
    fawaid: under(all, "الفوائد").flatMap((s) => s.lines),
  };
}

/**
 * The pattern al-Ṣāfī weighs a word by, where he gives one: «وزنه فيعول»,
 * «زنة يفعلون», «على وزن أفعل». Only a word of the scale's own letters — the
 * three of ف ع ل with what is added to them — is taken for a pattern.
 */
export function waznOf(text: string): string | null {
  const m = /(?:وزنه|وزنها|زنة|على\s+وزن|بوزن)\s+([ء-يً-ْ]{2,12})/u.exec(text);
  if (!m) return null;
  const w = m[1];
  const letters = bare(w);
  if (!/ف/.test(letters) || !/ع/.test(letters)) return null;
  return w;
}

// ── al-Daʿʿās and al-Iʿrāb al-muyassar: ﴿…﴾ and its office ──────────────────

/** «﴿اللَّهُ﴾ لفظ الجلالة مبتدأ ﴿لا﴾ نافية للجنس…» — a phrase, then its office. */
export function ornate(text: string, words: string[], byLine = false): Remark[] {
  const align = aligner(words);
  const out: Remark[] = [];
  const body = clean(text);
  if (byLine) {
    // One phrase to a line, its office after the colon; a ﴿…﴾ inside the
    // office is a reference, not the next phrase.
    for (const raw of body.split("\n")) {
      const m = /^\s*﴿([^﴾]{1,200})﴾\s*[:：]?\s*([\s\S]*)$/u.exec(raw);
      if (!m) {
        if (out.length && raw.trim()) out[out.length - 1].text += ` ${raw.trim()}`;
        continue;
      }
      const { text: t, notes } = withoutNotes(m[2]);
      out.push({ quote: m[1].trim(), text: t, notes, at: align.next(m[1]) });
    }
    return out;
  }
  const re = /﴿([^﴾]{1,200})﴾/gu;
  let m: RegExpExecArray | null;
  let open: { quote: string; start: number; at: Placed | null } | null = null;
  const close = (end: number) => {
    if (!open) return;
    const { text: t, notes } = withoutNotes(body.slice(open.start, end));
    out.push({ quote: open.quote, text: t, notes, at: open.at });
  };
  while ((m = re.exec(body))) {
    close(m.index);
    open = { quote: m[1].trim(), start: m.index + m[0].length, at: align.next(m[1]) };
  }
  close(body.length);
  return out;
}

// ── Darwīsh ─────────────────────────────────────────────────────────────────

export interface Darwish {
  lughah: Remark[];
  iraab: Remark[];
  balagha: Device[];
  fawaid: string[];
}

/** A figure of speech as a book names and explains it, and the words it is in. */
export interface Device {
  name: string;
  text: string;
  /** Every stretch of the ayah the explanation quotes. */
  at: Placed[];
}

/** Every quotation of the ayah inside a stretch of explanation, wherever it falls. */
export function quotedIn(text: string, words: string[]): Placed[] {
  const out: Placed[] = [];
  const align = aligner(words);
  const re = /[﴿«{(]([^﴾»})\n]{2,160})[﴾»})]/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const sk = quoteSkeleton(m[1]);
    // A quotation too short to be the ayah's rather than any word's is skipped.
    if (sk.length < 3) continue;
    const at = align.find(m[1], 0);
    if (at && !out.some((p) => p.from === at.from && p.to === at.to)) out.push(at);
  }
  return out;
}

/**
 * Darwīsh's numbered figures: «1- الاستئناف: …», «2- …». A figure runs on
 * until the next number. What stands before the first number is the
 * introduction to them, kept as a figure with no name.
 */
export function devices(lines: string[], words: string[]): Device[] {
  const out: Device[] = [];
  for (const line of lines) {
    const m = /^\s*([0-9٠-٩]{1,2})\s*[-–ـ.)]\s*(.*)$/u.exec(line);
    if (m) {
      const rest = withoutNotes(m[2]).text;
      const colon = rest.search(/[:：]/u);
      const name = colon > 0 && colon <= 60 ? rest.slice(0, colon).trim() : "";
      const text = name ? rest.slice(colon + 1).trim() : rest;
      out.push({ name, text, at: [] });
    } else if (out.length) {
      out[out.length - 1].text += `\n${withoutNotes(line).text}`;
    } else {
      out.push({ name: "", text: withoutNotes(line).text, at: [] });
    }
  }
  for (const d of out) d.at = quotedIn(`${d.name} ${d.text}`, words);
  return out;
}

export function readDarwish(text: string, words: string[]): Darwish {
  const all = sections(text);
  return {
    lughah: under(all, "اللغة").flatMap((s) => bracketed(s.lines.join("\n"), words)),
    iraab: under(all, "الإعراب", "الاعراب").flatMap((s) => bracketed(s.lines.join("\n"), words)),
    balagha: under(all, "البلاغة").flatMap((s) => devices(s.lines, words)),
    fawaid: under(all, "الفوائد").flatMap((s) => s.lines),
  };
}

// ── al-Samīn and the long grammars: one phrase, then everything on it ───────

/**
 * «قوله تعالى: {الله لاَ إله إِلاَّ هُوَ} : مبتدأٌ وخبرٌ…» — a phrase of the ayah,
 * and the discussion of it down to the next.
 */
export function byPhrase(text: string, words: string[]): Remark[] {
  const body = clean(text);
  const re = /(?:^|\n|\.\s)\s*(?:و?قوله|و?قَوْلُهُ)\s*(?:تعالى|تَعالى|عز وجل|جل وعز|جل ذكره)?\s*[:：]?\s*[{﴿]([^}﴾]{1,300})[}﴾]/gu;
  const marks: { quote: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) marks.push({ quote: m[1].trim(), start: m.index, end: m.index + m[0].length });
  if (!marks.length) {
    const { text: t, notes } = withoutNotes(body);
    return t ? [{ quote: "", text: t, notes, at: null }] : [];
  }
  const align = aligner(words);
  const out: Remark[] = [];
  const lead = withoutNotes(body.slice(0, marks[0].start));
  if (lead.text) out.push({ quote: "", text: lead.text, notes: lead.notes, at: null });
  marks.forEach((mk, i) => {
    const { text: t, notes } = withoutNotes(body.slice(mk.end, marks[i + 1]?.start ?? body.length));
    out.push({ quote: mk.quote, text: t, notes, at: align.find(mk.quote, align.cursor) ?? align.find(mk.quote, 0) });
  });
  return out;
}

// ── the readings ────────────────────────────────────────────────────────────

/** A word of the ayah read in more than one way, as al-Abyārī lists it. */
export interface Variant {
  quote: string;
  /** Whether he marks these readings as outside the accepted ones. */
  shadh: boolean;
  readings: string[];
  at: Placed | null;
}

/**
 * «القيوم:\nقرئ:\n1- القيوم، على وزن «فيعول»، وهى قراءة الجمهور.\n2- …» — a word,
 * whether its readings are the irregular ones, and each reading and its readers.
 */
export function readMawsuah(text: string, words: string[]): Variant[] {
  const out: Variant[] = [];
  const align = aligner(words);
  let current: Variant | null = null;
  for (const raw of clean(text).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const said = /^و?\s*قرئ(?:ت)?\s*(شاذا|شاذًا|شاذّا)?\s*[:：]\s*(.*)$/u.exec(line);
    if (said && current) {
      current.shadh = current.shadh || !!said[1];
      if (said[2]) current.readings.push(said[2]);
      continue;
    }
    const head = /^([^:：\d٠-٩]{1,40})\s*[:：]\s*$/u.exec(line);
    if (head) {
      current = { quote: head[1].trim(), shadh: false, readings: [], at: align.find(head[1], align.cursor) };
      if (current.at) align.next(head[1]);
      out.push(current);
      continue;
    }
    const n = /^[0-9٠-٩]{1,2}\s*[-–.)]\s*(.*)$/u.exec(line);
    if (current) current.readings.push(n ? n[1] : line);
  }
  return out.filter((v) => v.readings.length);
}

/** The words of the ayah a book of the ten readings names, wherever in its text. */
export function namedWords(text: string, words: string[]): Placed[] {
  return quotedIn(clean(text), words);
}

// ── the transmitted reports: Ibn Abī Ḥātim, then al-Ṭabarī and al-Durr ───────

/** `out` is a report the owner has ruled off the page: Muqātil ibn Sulaymān's. */
export type Tier = "sahabah" | "tabiun" | "atba" | "marfu" | "unknown" | "out";

export interface Report {
  /** His number for the report, where the edition numbers them. */
  n: string;
  text: string;
  /** The phrase of the ayah the report is given under. */
  phrase: string;
  at: Placed | null;
  /** The last authority in the chain. */
  who: string;
  /** What the chain itself calls him, where that is a bare name the page resolved. */
  named: string;
  tier: Tier;
  /** «ورُوِيَ عَنْ مُجاهِدٍ، وقَتادَةَ، نَحْوُ ذَلِكَ» — who else is reported to say it. */
  also: string;
}

/**
 * The authorities a report on the Qurʾān most often ends at, and which
 * generation each is of: the Companions, the Followers, and those of the
 * generation after them who are quoted for tafsir. Names as the chains write
 * them, without vowels, and with a hamza's seat written as a plain alif.
 *
 * Only the last link of a chain is looked up, and it must be the name: a chain
 * whose last link is a man not listed here is not credited to the listed man
 * before him. A bare name that could be two men — «عبد الله», «علي», «جابر»,
 * «سعيد», «مقاتل» — is resolved by `BARE` below, and the page says so. A name not
 * placed either way is "unknown": the page shows it with its chain and without a
 * generation.
 */
const SAHABAH = [
  "ابن عباس", "عبد الله بن عباس", "ابن مسعود", "عبد الله بن مسعود", "علي بن ابي طالب", "عمر بن الخطاب", "عمر",
  "ابي بن كعب", "ابي هريرة", "ابو هريرة", "عائشة", "ابن عمر", "عبد الله بن عمر", "جابر بن عبد الله",
  "انس بن مالك", "انس", "ابي سعيد الخدري", "ابو سعيد الخدري", "ابي سعيد", "ابي ذر", "ابو ذر", "معاذ بن جبل",
  "ابي موسى", "ابو موسى", "ابي الدرداء", "ابو الدرداء", "ابن الزبير", "عبد الله بن الزبير", "عبد الله بن عمرو",
  "ابن عمرو", "عثمان بن عفان", "ابي بكر الصديق", "ابو بكر الصديق", "زيد بن ثابت", "حذيفة", "البراء بن عازب",
  "البراء", "سلمان", "سلمان الخير", "سلمان الفارسي", "ابي امامة", "ابو امامة", "عمار بن ياسر", "ام سلمة",
  "عبادة بن الصامت", "ابن ابي اوفى", "عبد الله بن ابي اوفى", "عبد الله بن سلام", "ابي برزة", "النعمان بن بشير",
  "عقبة بن عامر", "ابي ايوب", "سعد بن ابي وقاص", "جندب", "سمرة بن جندب", "ابي قتادة", "عبد الرحمن بن عوف",
  "المغيرة بن شعبة", "عدي بن حاتم", "بريدة", "ثوبان", "سهل بن سعد", "رافع بن خديج", "كعب بن مالك", "صهيب",
  "ابي الطفيل", "ابو الطفيل", "علي رضي الله عنه", "علي رضى الله عنه", "عليا رضي الله عنه",
];
const TABIUN = [
  "مجاهد", "مجاهد بن جبر", "قتادة", "قتادة بن دعامة", "الحسن", "الحسن البصري", "عكرمة", "عكرمة مولى ابن عباس",
  "سعيد بن جبير", "الضحاك", "الضحاك بن مزاحم", "السدي", "اسماعيل السدي", "ابي العالية", "ابو العالية",
  "الربيع بن انس", "الربيع", "عطاء", "عطاء بن ابي رباح", "عطاء الخراساني", "زيد بن اسلم", "محمد بن كعب",
  "الشعبي", "عامر", "عامر الشعبي", "ابراهيم النخعي", "ابراهيم", "طاوس", "طاوس بن كيسان", "عطية", "عطية العوفي",
  "سعيد بن المسيب", "ابي مالك", "ابو مالك", "ابي صالح", "ابو صالح", "وهب بن منبه", "الزهري", "ابن شهاب",
  "ابي جعفر", "محمد بن علي", "علي بن الحسين", "عمرو بن دينار", "زر بن حبيش", "مسروق", "مسروق بن الاجدع",
  "ابي وائل", "شقيق", "علقمة", "علقمة بن قيس", "عبيدة", "ابي رزين", "ابن سيرين", "محمد بن سيرين", "ثابت البناني",
  "يحيى بن ابي كثير", "كعب الاحبار", "كعب", "جابر بن زيد", "ابي الجلد", "مطر", "حسان بن عطية", "يزيد بن ابي حبيب",
  "عبد الله بن كثير", "ابن اسحاق", "محمد بن اسحاق", "ابي عمران الجوني", "اسماعيل بن ابي خالد", "عروة",
  "عروة بن الزبير", "ابي مجلز", "ميمون بن مهران", "مكحول", "الاعمش", "عمر بن عبد العزيز", "نافع", "سالم",
  "قتاده", "القرظي", "يزيد بن رومان", "عبيد بن عمير", "عبد الله بن عبيد بن عمير", "عمرو بن ميمون", "ابي العبيدين",
  "عطاء بن يسار", "شهر بن حوشب", "الربيع بن خثيم", "ابراهيم التيمي", "ابي الضحى", "عبد الله بن شداد", "مصعب بن سعد",
  "ابي ميسرة", "ابي قلابة", "طلق بن حبيب", "علي بن ربيعة", "شريح", "خالد بن عرعرة",
  "محمد بن جعفر بن الزبير", "مالك بن دينار", "ابن ابي مليكة", "الحكم", "وهب", "ابي عبيدة", "ابي الجوزاء",
  "سالم بن ابي الجعد", "ابن المسيب", "القاسم بن ابي بزة", "عبد الله بن الحارث", "عبد الرحمن بن ابي ليلى", "خيثمة",
  "ثابت", "القاسم بن محمد", "ابي عبد الرحمن", "ابي اسحاق", "ابي رجاء", "شمر بن عطية", "شمر", "عاصم", "سليمان التيمي",
  "عباد بن عبد الله بن الزبير", "علي بن رباح", "ابي نجيح",
];
const ATBA = [
  "ابن جريج", "سفيان", "سفيان الثوري", "الثوري", "ابن عيينة", "سفيان بن عيينة", "مقاتل بن حيان", "ابن زيد",
  "عبد الرحمن بن زيد", "الاوزاعي", "مالك بن انس", "مالك", "سعيد بن عبد العزيز", "ابن ابي نجيح", "خصيف", "معمر",
  "معمر بن راشد", "عبد الصمد بن معقل", "زهير بن محمد", "الكلبي", "ابي روق", "ابي جعفر الرازي",
];

const NAMES = new Map<string, Tier>([
  ...ATBA.map((n) => [n, "atba"] as [string, Tier]),
  ...TABIUN.map((n) => [n, "tabiun"] as [string, Tier]),
  ...SAHABAH.map((n) => [n, "sahabah"] as [string, Tier]),
]);
const LONGEST_FIRST = [...NAMES.keys()].sort((a, b) => b.length - a.length);

/** A link of a chain: the word that hands the report on to the next narrator. */
const LINK_WORD = "عن|ثنا|ثني|ثنى|نا|ابنا|انبا|انبانا|حدثنا|حدثني|حدثه|اخبرنا|اخبرني|سمعت|سالت";
const LINK = new RegExp(`(?:^|[\\s،,])(?:${LINK_WORD})\\s+`, "gu");
const LINK_NEXT = new RegExp(`^(?:${LINK_WORD})\\s`, "u");
/** Where a chain gives way to what was said. */
const SAYS = /\s(?:قال|قالت|قالوا|قوله|في\s+قول|في\s+هذه|في\s+الاية|عن\s+قول|عن\s+هذه|يقول|يعني|انه|انها|انهم)(?=[\s:：،,])|\s*[﴿(:：]/gu;
/** That what follows is the Prophet's ﷺ, whoever hands it on. */
const RAISED = /(?:^|[\s،,«])(?:ان|عن|قال|سمعت|سالت|سال|سئل|رايت)\s+(?:رسول\s+الله|النبي)|^\s*«?(?:رسول\s+الله|النبي)|يرفعه|رفعه|مرفوعا/u;

/** Where a report's chain gives way to what was said. */
function chainEnd(plain: string): number {
  for (const m of plain.matchAll(SAYS)) {
    // «حدثنا أبي، قال: ثنا…» is still the chain.
    const after = plain.slice((m.index ?? 0) + m[0].length).replace(/^[\s:：،,]+/u, "");
    if (!LINK_NEXT.test(after)) return m.index ?? 0;
  }
  return plain.length;
}

/** A report's chain, without vowels and with its hamzas on plain alifs. */
export function chainOf(report: string): string {
  const plain = bare(report).replace(/[أإآ]/g, "ا");
  return plain.slice(0, chainEnd(plain));
}

/** «عن أبيه»: whose father, by the son who hands it on. */
const FATHERS: [RegExp, string][] = [
  [/ابن\s+طاوس/u, "طاوس"],
  [/عثمان\s+بن\s+عطاء/u, "عطاء الخراساني"],
  [/هشام/u, "عروة بن الزبير"],
  [/المعتمر/u, "سليمان التيمي"],
  [/يحيى\s+بن\s+عباد/u, "عباد بن عبد الله بن الزبير"],
  [/جعفر\s+بن\s+محمد/u, "محمد بن علي"],
  [/ابن\s+ابي\s+جعفر/u, "ابي جعفر الرازي"],
  [/عبد\s+الرحمن\s+بن\s+زيد|ابن\s+زيد/u, "زيد بن اسلم"],
  [/مصعب\s+بن\s+سعد/u, "سعد بن ابي وقاص"],
  [/موسى\s+بن\s+علي/u, "علي بن رباح"],
  [/سالم/u, "ابن عمر"],
  [/ابن\s+ابي\s+نجيح/u, "ابي نجيح"],
];

/**
 * Who a bare name is. The chains of tafsir have their conventions, and the man
 * who hands a report on usually settles it: «عبد الله» in these chains is Ibn
 * Masʿūd, «علي» is the Companion, and «سعيد» is Ibn Jubayr, or Ibn al-Musayyab from
 * Qatāda and al-Zuhrī. «مقاتل» is Ibn Ḥayyān in Ibn Abī Ḥātim's chains; elsewhere he
 * may be Ibn Sulaymān, whom the owner has ruled off the page.
 */
const BARE: Record<string, (before: string, line: string) => string> = {
  "عبد الله": () => "ابن مسعود",
  "عبد الله بن مسعود": () => "ابن مسعود",
  علي: () => "علي بن ابي طالب",
  عليا: () => "علي بن ابي طالب",
  سعيد: (before) => (/قتادة|الزهري|ابن\s+شهاب|يحيى\s+بن\s+سعيد/u.test(before) ? "سعيد بن المسيب" : "سعيد بن جبير"),
  جابر: () => "جابر بن عبد الله",
  جابرا: () => "جابر بن عبد الله",
  مقاتل: (before, line) => (/بكير/u.test(before) || /ابن\s+ابي\s+حاتم/u.test(line) ? "مقاتل بن حيان" : "مقاتل بن سليمان"),
  ابيه: (before) => FATHERS.find(([son]) => son.test(before))?.[1] ?? "",
  محمد: (before) => (/ايوب|ابن\s+عون|عوف|هشام/u.test(before) ? "محمد بن سيرين" : ""),
  عمرو: (before) => (/سفيان/u.test(before) ? "عمرو بن دينار" : ""),
};

/** A bare name, once the man before it has been consulted. */
function resolve(name: string, before: string, line: string): { who: string; tier: Tier; named: string } | null {
  const rule = BARE[name];
  const who = rule ? rule(before, line) : "";
  if (!who) return null;
  if (who === "مقاتل بن سليمان") return { who, tier: "out", named: name };
  const placed = place(who);
  return placed ? { ...placed, named: name } : null;
}

/** Who a chain ends at: its last link, if that is a man the page can place. */
export function authorityOf(report: string): { who: string; tier: Tier; named: string } {
  const plain = bare(report).replace(/[أإآ]/g, "ا");
  const end = chainEnd(plain);
  const links = [...plain.slice(0, end).matchAll(LINK)];
  // The last link with a name after it: «سألت الحسن عن قوله…» ends at al-Ḥasan.
  let from = -1;
  let name = "";
  for (let i = links.length - 1; i >= 0 && !name; i--) {
    from = (links[i].index ?? 0) + links[i][0].length;
    name = plain
      .slice(from, i + 1 < links.length ? (links[i + 1].index ?? end) : end)
      .split(/[،,]|\sفي(?:\s|$)/u)[0]
      .replace(/\s+عن$/u, "")
      .replace(/\s+ب?(?:نحوه|مثله)\.?$|\.$/u, "")
      .trim();
  }
  if (!name) return { who: "", tier: "unknown", named: "" };
  if (RAISED.test(plain.slice(from, end + 70))) return { who: name, tier: "marfu", named: "" };
  const lastLink = links.findLastIndex((l) => (l.index ?? 0) + l[0].length <= from - 1 || (l.index ?? 0) + l[0].length < from);
  const before = lastLink >= 0 ? plain.slice((links[lastLink].index ?? 0) + links[lastLink][0].length, from).split(/[،,]|\sعن\s/u)[0].trim() : "";
  // «ثنا سلمة، قال محمد بن إسحاق: …», «عن ابن جريج، قال: قال مجاهد: …» — the chain
  // hands on to a man named after «قال», and he is its last link.
  const after = /^\s*(?:قال[:：،,]?\s+)+([^:：،,]{2,40})/u.exec(plain.slice(end));
  const handedOn = after ? plain.slice(end + after[0].length).replace(/^[،,]\s*/u, "") : "";
  // «قال ابن زيد، أخبرني ابن لهيعة، عن…» — and he only hands it on again.
  if (after && LINK_NEXT.test(handedOn)) return authorityOf(handedOn);
  const named = (spelled: string) => {
    const known = place(spelled);
    return known ? { ...known, named: "" } : null;
  };
  return (after && named(after[1].trim())) || resolve(name, before, plain) || named(name) || { who: name, tier: "unknown", named: "" };
}

/** A name, if it is one of those listed: the whole name, or one the list's two words begin. */
function place(spelled: string): { who: string; tier: Tier } | null {
  // A kunya the list writes after «عن» may stand in another case: «سمعت أبا معاذ».
  for (const name of [spelled, spelled.replace(/^(?:ابا|ابو)\s/u, "ابي ")]) {
    for (const known of LONGEST_FIRST) {
      // A name governed by a verb — «سمعت مجاهدا» — takes an alif the list does not.
      if (name === known || name === `${known}ا` || (known.includes(" ") && name.startsWith(`${known} `))) {
        return { who: known, tier: NAMES.get(known) ?? "unknown" };
      }
    }
  }
  // «عن قتادة والحسن»: two men, and the first is enough to place the report.
  const two = /^(.+?)\s+و\S\S/u.exec(spelled);
  return two ? place(two[1]) : null;
}

/**
 * A report's number in Ibn Abī Ḥātim, however the copy sets it: «[٢٥٧٠]»,
 * «[٧ ]», «[ ١٠٣]», «١٧٢ -», «٥٧٩١», and once in a while with a stray number
 * before it.
 */
const HATIM_NUMBER = /^(?:\[\s*([\d٠-٩]{1,6})\s*\]|(?:[\d٠-٩]{1,3}\s+)?([\d٠-٩]{1,6})\s*(?:[-–]|(?=\s)))\s*([\s\S]*)$/u;
/** A report in his copy that has lost its number, and still opens with its chain. */
const HATIM_UNNUMBERED = /^(?:حدثنا|حدثني|اخبرنا|اخبرني|قرات|قرئ)(?=[\s،,:])/u;

/**
 * Ibn Abī Ḥātim: «قَوْلُهُ: ﴿…﴾», and then his reports on that phrase, each
 * opening with its number in the edition.
 */
export function readReports(text: string, words: string[]): Report[] {
  const out: Report[] = [];
  const align = aligner(words);
  let phrase = "";
  let at: Placed | null = null;
  for (const raw of clean(text).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const head = /^(?:و?قَوْلُهُ|و?قوله)\s*(?:تَعالى|تعالى)?\s*[:：]?\s*﴿([^﴾]{1,300})﴾/u.exec(line);
    if (head) {
      phrase = head[1].trim();
      at = align.find(phrase, align.cursor) ?? align.find(phrase, 0);
      if (at) align.next(phrase);
      continue;
    }
    const r = HATIM_NUMBER.exec(line);
    const unnumbered = !r && HATIM_UNNUMBERED.test(bare(line).replace(/[أإآ]/g, "ا"));
    if (!r && !unnumbered) {
      if (out.length && !/^الوَجْهُ|^الوجه/u.test(line)) out[out.length - 1].text += `\n${line}`;
      continue;
    }
    const body = r ? r[3] : line;
    const alsoAt = body.search(/[.،]\s*و?رُوِيَ\s+عَنْ|[.،]\s*وروي\s+عن/u);
    const main = alsoAt >= 0 ? body.slice(0, alsoAt + 1) : body;
    const also = alsoAt >= 0 ? body.slice(alsoAt + 1).trim() : "";
    // «وبه» is the chain of the report before, not repeated.
    const prior = /^\s*وب(?:ه|ِهِ)(?=[\s:،,])/u.test(body) ? out[out.length - 1] : undefined;
    const { who, tier, named } = prior ?? authorityOf(main);
    out.push({ n: r ? (r[1] ?? r[2]) : "", text: main.trim(), phrase, at, who, named, tier, also });
  }
  return out;
}

/** A quotation of the ayah, the copy's mismatched brackets allowed for: «(وَالنَّجْمِ إِذَا هَوَى﴾». */
const QUOTED = /﴿([^﴿﴾]{2,400})﴾|\(([^()﴿﴾]{2,400})﴾|﴿([^()﴿﴾]{2,400})\)/gu;
/** A line of al-Ṭabarī that is a report: his mark, or a number, or where the copy lost both, a chain opening. */
const TABARI_REPORT = /^⁕|^(?:[٠-٩\d]{1,6}\s*[-–]\s*)?و?(?:حدثنا|حدثني|حدثت\s+عن)(?=[\s،,:])/u;
/** A line of al-Durr al-manthūr that is a report: «وأخرج ابن جرير عن…». */
const DURR_REPORT = /^و?اخرج(?=[\s،,])/u;
/** A report that only says it is like the one before: «…عن مجاهد، مثله.» */
const SAME_AS_BEFORE = /(?:ب?مثله|ب?نحوه)\s*[.،]?\s*$/u;
/** Where a line takes up a phrase of the ayah: «وقوله: ﴿…», «اختلف أهل التأويل في تأويل قوله: ﴿…». */
const TAKES_UP = /قوله(?:\s+تعالى)?\s*[:：]?\s*[﴿(]/u;
const SURAH_HEAD = /^سورة\s/u;
/** A book's paragraph, with an editor's note that runs over several lines kept on one. */
const NOTE_LINES = /\[\[[\s\S]*?\]\]/g;

/**
 * A book of many reports with no order of its own, each on its own line. What
 * is not a report is the author's own, and is read only for the phrase he has
 * reached, unless `runsOn`: there a line that is not a report belongs to the
 * report before it.
 *
 * A report is on the phrase it quotes where its chain ends, or else on the last
 * phrase the book took up, or else on the whole passage. But the copies do not
 * always keep a passage to the ayat it is filed under: al-Ṭabarī's whole of
 * al-ʿĀdiyāt stands under its last two. So a phrase that is not in this passage
 * ends the reading: what follows it is on no word here, and `at` is null, until
 * a phrase that is.
 */
function readLines(text: string, words: string[], isReport: RegExp, runsOn: boolean): Report[] {
  const out: Report[] = [];
  const align = aligner(words);
  let phrase = "";
  let at: Placed | null = words.length ? { from: 0, to: words.length - 1 } : null;
  const quotation = (m: RegExpMatchArray) => {
    const quote = (m[1] ?? m[2] ?? m[3]).replace(/\(?[٠-٩\d]+\)?/gu, " ").trim();
    if (quoteSkeleton(quote).length < 3) return null;
    return { quote, found: align.find(quote, at?.from ?? 0) ?? align.find(quote, 0) };
  };
  for (const raw of clean(text).replace(NOTE_LINES, (note) => note.replace(/\n/g, " ")).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const plain = bare(line).replace(/[أإآ]/g, "ا");
    if (!isReport.test(plain)) {
      if (SURAH_HEAD.test(plain) && plain.length < 60) {
        at = null;
        phrase = "";
        continue;
      }
      const takesUp = TAKES_UP.test(plain);
      let read = false;
      for (const m of line.matchAll(QUOTED)) {
        const got = quotation(m);
        if (!got) continue;
        if (got.found) {
          const everything = got.found.from === 0 && got.found.to === words.length - 1;
          phrase = everything ? "" : got.quote;
          at = got.found;
          read = true;
          break;
        }
        if (takesUp) {
          phrase = "";
          at = null;
          read = true;
          break;
        }
      }
      if (!read && runsOn && out.length) out[out.length - 1].text += `\n${line}`;
      continue;
    }
    const body = line.replace(/^⁕\s*/u, "");
    if (SAME_AS_BEFORE.test(plain) && !body.includes("﴾") && out.length) {
      const last = out[out.length - 1];
      last.also = last.also ? `${last.also} ${body}` : body;
      continue;
    }
    const { who, tier, named } = authorityOf(body);
    let own: { quote: string; found: Placed | null } | null = null;
    for (const m of body.matchAll(QUOTED)) {
      const got = quotation(m);
      if (!got) continue;
      // A phrase at the end of the chain is the report's own. One quoted further
      // on, in what was said, may be another ayah brought in as evidence.
      const before = bare(body.slice(0, m.index ?? 0));
      const chain = before.slice(before.lastIndexOf(" عن "));
      if (got.found || !/قال|يقول/u.test(chain)) own = got;
      break;
    }
    out.push({
      n: "",
      text: body,
      phrase: own ? own.quote : phrase,
      at: own ? own.found : at,
      who,
      named,
      tier,
      also: "",
    });
  }
  return out;
}

/** Al-Ṭabarī: his reports, each with its chain. His own reasoning stays in chapter eight. */
export function readTabari(text: string, words: string[]): Report[] {
  return readLines(text, words, TABARI_REPORT, false);
}

/** Al-Suyūṭī's al-Durr al-manthūr: who collected each report and its last authority, and no chain. */
export function readDurr(text: string, words: string[]): Report[] {
  return readLines(text, words, DURR_REPORT, true);
}

// ── what can be drawn from it: Aysar, Ibn ʿUthaymīn ─────────────────────────

/** Aysar al-tafāsīr's three parts: the words, the meaning, and the guidance. */
export interface Aysar {
  words: { quote: string; text: string }[];
  meaning: string[];
  guidance: string[];
}

export function readAysar(text: string): Aysar {
  const out: Aysar = { words: [], meaning: [], guidance: [] };
  let part: "words" | "meaning" | "guidance" | "" = "";
  for (const raw of clean(text).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const b = bare(line);
    if (/^شرح الكلمات/.test(b)) {
      part = "words";
      continue;
    }
    if (/^معنى الآي/.test(b)) {
      part = "meaning";
      continue;
    }
    if (/^هداية الآي/.test(b) || /^من هداية/.test(b)) {
      part = "guidance";
      continue;
    }
    if (part === "words") {
      const m = /^([^:：]{1,80})[:：]\s*(.+)$/u.exec(line);
      if (m) out.words.push({ quote: m[1].trim(), text: m[2].trim() });
    } else if (part === "meaning") out.meaning.push(line);
    else if (part === "guidance") out.guidance.push(line.replace(/^[0-9٠-٩]{1,2}\s*[-–.)]\s*/u, ""));
  }
  return out;
}

/**
 * Ibn ʿUthaymīn's benefits: «ومن فوائد الآية الكريمة: …» opens each, and it runs
 * to the end of its paragraph — his evidence for it, «لقوله: ﴿…﴾», included.
 */
export function benefits(text: string): string[] {
  const out: string[] = [];
  for (const raw of clean(text).split("\n")) {
    // His lessons are transcribed with a star before whoever speaks: «* ومن فوائد…».
    const line = raw.trim().replace(/^\*\s*/, "");
    const m = /^(?:و?من\s+فوائد[^:：]{0,40}|الفائدة\s+[^:：]{1,24})[:：]\s*(.+)$/u.exec(line);
    if (m) out.push(withoutNotes(m[1]).text);
  }
  return out;
}

/** Every paragraph of a passage, footnotes taken out, for a work read whole. */
export function paragraphsOf(text: string): string[] {
  return clean(text)
    .split("\n")
    .map((l) => withoutNotes(l).text)
    .filter(Boolean);
}
