import { clean } from "./read";
import { aligner, bare, quoteSkeleton, type Placed } from "./skeleton";

/**
 * Where the scholars differ, as the books that record it say so.
 *
 * Some books are built on it. Ibn al-Jawzī and al-Māwardī take a phrase, say how
 * many views there are on it, number them, and name who held each: «وفي المراد
 * بالنجم خمسة أقوال. أحدها: أنه الثريا، رواه العوفي عن ابن عباس… والثاني: …».
 * Al-Samīn does the same for the grammar: «فيه وجهان: أحدهما… والثاني…».
 *
 * So the differences on the page are not worked out by comparing what scholars
 * wrote, which would be a judgement, and none is summarised. Each is the book's
 * own count of the views, its own words for each, and the names it gives. A list
 * whose views cannot all be found is not shown at all: a list cut short would say
 * there are fewer views than the book says there are.
 */

export interface Holder {
  /** Who held it, as the book names him. */
  who: string;
  /** Through whom, where the book says: «رواه العوفي عن ابن عباس». */
  via: string;
}

export interface View {
  /** Its place in the book's list, from 1. */
  n: number;
  /** The book's words for it. */
  text: string;
  holders: Holder[];
}

export interface Difference {
  /** What they differ on, in the book's words: «وفي المراد بالنجم». */
  topic: string;
  /** The phrase of the ayah the book was on. */
  phrase: string;
  at: Placed | null;
  views: View[];
}

const COUNTS: Record<string, number> = {
  قولان: 2, قولين: 2, وجهان: 2, وجهين: 2, تاويلان: 2, تاويلين: 2, روايتان: 2, روايتين: 2, مذهبان: 2, مذهبين: 2,
  ثلاثة: 3, اربعة: 4, خمسة: 5, ستة: 6, سبعة: 7, ثمانية: 8, تسعة: 9, عشرة: 10,
};
const ORDINALS = ["", "", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];

/** «خمسة أقوال», «قولان», «ثلاثة أوجه», «تأويلان»: a book saying how many views it will give. */
const LIST =
  /(?:^|[\s(])(قولان|قولين|وجهان|وجهين|تاويلان|تاويلين|روايتان|روايتين|مذهبان|مذهبين|(?:ثلاثة|اربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة)(?=\s+(?:اقوال|اوجه|تاويلات|اقاويل|روايات|مذاهب)))(?:\s+(?:اقوال|اوجه|تاويلات|اقاويل|روايات|مذاهب))?/gu;
/**
 * Where a book takes up a phrase: «قوله تعالى: ﴿…﴾», «وفي قوله ﴿…﴾», or the phrase
 * alone at the head of a line. «كقوله: ﴿…﴾» and the like are another ayah brought
 * in as evidence, and move the book on to nothing.
 */
const PHRASE = /(?:^|[\n.؛:]\s*|\s)(?:و?في\s+)?و?قوله(?:\s+تعالى)?\s*[:：]?\s*[﴿{(]|(?:^|\n)\s*[﴿{]/gu;

/** The furthest a book's list runs from its count to its first view. */
const TO_FIRST = 70;
/** The furthest one view runs before the next is expected. */
const VIEW_LENGTH = 2600;

interface Plain {
  plain: string;
  /** For each letter of `plain`, where it stands in the text. */
  at: number[];
}

/** The text without vowels and with its hamzas on plain alifs, and the way back. */
function plainOf(text: string): Plain {
  const at: number[] = [];
  let plain = "";
  for (let i = 0; i < text.length; i++) {
    const kept = bare(text[i]);
    if (!kept) continue;
    plain += kept.replace(/[أإآ]/g, "ا");
    at.push(i);
  }
  return { plain, at };
}

const STARTS_VIEW = /[\s.،:؛»"”)﴾}]$/u;
/** The next view's opening word, where a sentence could begin. */
function ordinal(plain: string, word: RegExp, from: number, limit: number): { start: number; end: number } | null {
  word.lastIndex = from;
  for (let m = word.exec(plain); m && m.index < limit; m = word.exec(plain)) {
    if (m.index === 0 || STARTS_VIEW.test(plain.slice(Math.max(0, m.index - 2), m.index))) {
      return { start: m.index, end: m.index + m[0].length };
    }
  }
  return null;
}

/** Who held a view: «قاله ابن عباس، ومجاهد», «رواه العوفي عن ابن عباس», «وهو قول قتادة». */
const NAMED = /(?:^|[\s.،:؛])(?:قاله|قالهما|رواه|روياه|روي\s+عن|ذكره|حكاه|جوزه|وهو\s+قول|وهذا\s+قول|هذا\s+قول|وهو\s+مذهب|وهذا\s+مذهب|هذا\s+مذهب|وبه\s+قال|وهو\s+مروي\s+عن|وهو\s+رواية|ذهب\s+اليه|واليه\s+ذهب|وهو\s+اختيار|واختاره|اختاره)\s+/gu;
const NOT_A_NAME = /^(?:قال|في|من|ان|انه|لان|هذا|هذه|ذلك|كما|اي|لانه|وقد|قد|ثم|على|الى|اذا|ما|لا|لم|بعض|جماعة|به|هو|هي|هم|فيه|فيها|منه|منها|له|لها|كان|كانت|وهو|وهي|عنه|عنها|بن|رسول|النبي)$/u;
const THE_PROPHET = /رسول\s+الله|النبي/u;

/** A run of names, up to where the sentence turns to something else. */
function namesIn(run: string): Holder[] {
  const out: Holder[] = [];
  const line = run.split(/[.:؛\n]/u)[0].split(/\s+(?:في\s+رواية|في\s+قول|وقال|فقال|قال|لان|لانه|لانهم|يعني|اي|ومنه|ومن)\b/u)[0];
  for (const part of line.split(/[،,]|\s+و(?=[^\s]{2})/u)) {
    const name = part.replace(/^و/u, "").replace(/\s+ايضا$/u, "").trim();
    if (!name) continue;
    // «رواه سالم الأفطس، عن سعيد»: the same man, a comma before who he had it from.
    const onward = /^عن\s+(.{2,30})$/u.exec(name);
    if (onward && out.length) {
      const last = out[out.length - 1];
      out[out.length - 1] = { who: onward[1].trim(), via: last.who };
      continue;
    }
    const words = name.split(/\s+/u);
    if (words.length > 6 || NOT_A_NAME.test(words[0]) || /[﴿﴾{}«»"[\]\d٠-٩]/u.test(name)) break;
    const via = /^(.{2,60})\s+عن\s+(.{2,30})$/u.exec(name);
    const holder = via ? { who: via[2].trim(), via: via[1].trim() } : { who: name, via: "" };
    // A report raised to the Prophet ﷺ is the book's to give and not a scholar's
    // view: it stays in the words of the view, and out of the list of who held it.
    if (THE_PROPHET.test(holder.who)) break;
    out.push(holder);
  }
  return out;
}

function holdersOf(plainView: string): Holder[] {
  const out: Holder[] = [];
  const seen = new Set<string>();
  // «قول يونس والأخفش»: a grammarian's view is often named before anything else.
  const opens = /^[\s:،]*(?:هو\s+)?(?:قول|مذهب)\s+/u.exec(plainView);
  const runs = opens ? [plainView.slice(opens[0].length, opens[0].length + 140)] : [];
  for (const m of plainView.matchAll(NAMED)) {
    const at = (m.index ?? 0) + m[0].length;
    runs.push(plainView.slice(at, at + 140));
  }
  for (const run of runs) {
    for (const h of namesIn(run)) {
      const key = `${h.who}|${h.via}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
    }
  }
  return out;
}

/** A name as the book spells it, hamzas and all: `plain` and `spelled` run letter for letter. */
function respelled(name: string, plain: string, spelled: string): string {
  const at = plain.indexOf(name);
  return at < 0 ? name : spelled.slice(at, at + name.length);
}

/** Al-Ṭabarī's own word between the views: «وأولى الأقوال في ذلك بالصواب…». */
const JUDGES = /^(?:و?اولى\s+(?:الاقوال|القولين|التاويلين|القراءتين|الاقوال)[^.]{0,60}بالصواب|و?الصواب\s+من\s+(?:القول|القراءة)|و?الصحيح\s+من\s+القول)/u;

export interface Judgement {
  text: string;
  at: Placed | null;
}

/** The lines of a book that give its author's own judgement, each on the phrase he had reached. */
export function readJudgements(text: string, words: string[]): Judgement[] {
  const out: Judgement[] = [];
  const align = aligner(words);
  let at: Placed | null = words.length ? { from: 0, to: words.length - 1 } : null;
  const quoted = /﴿([^﴿﴾]{2,300})﴾/u;
  for (const raw of clean(text).replace(/\[\[[\s\S]*?\]\]/g, (note) => note.replace(/\n/g, " ")).split("\n")) {
    const line = raw.trim();
    if (!line || /^[⁕\d٠-٩]|^حدث/u.test(line)) continue;
    const plain = bare(line).replace(/[أإآ]/g, "ا");
    if (/قوله(?:\s+تعالى)?\s*[:：]?\s*[﴿(]/u.test(plain.slice(0, 90))) {
      const m = quoted.exec(line);
      if (m) at = align.find(m[1].replace(/\(?[٠-٩\d]+\)?/gu, " "), 0);
    }
    if (JUDGES.test(plain)) out.push({ text: line, at });
  }
  return out;
}

/** Every list of views in a passage, each set on the phrase the book had reached. */
export function readViews(text: string, words: string[]): Difference[] {
  const source = clean(text).replace(/\[\[[\s\S]*?\]\]/g, " ");
  const { plain, at: raw } = plainOf(source);
  const spelled = bare(source);
  const align = aligner(words);
  const whole: Placed | null = words.length ? { from: 0, to: words.length - 1 } : null;
  const original = (from: number, to: number) => source.slice(raw[from], raw[Math.min(to, raw.length) - 1] + 1).trim();

  // Where the book takes up each phrase. A phrase not in this passage counts only
  // as a heading on its own line: the copy has moved on past the ayat it is filed
  // under, and what follows is on none of these words.
  const taken: { pos: number; quote: string; found: Placed | null }[] = [];
  for (const m of plain.matchAll(PHRASE)) {
    const pos = m.index ?? 0;
    const open = pos + m[0].length;
    const close = plain.slice(open, open + 400).search(/[﴾})]/u);
    if (close < 0) continue;
    const quote = original(open, open + close).replace(/\(?[٠-٩\d]+\)?/gu, " ").trim();
    if (quoteSkeleton(quote).length < 3) continue;
    const found = align.find(quote, taken.at(-1)?.found?.from ?? 0) ?? align.find(quote, 0);
    const heading = pos === 0 || plain[pos] === "\n" || plain[pos - 1] === "\n";
    if (found || heading) taken.push({ pos, quote, found });
  }

  const out: Difference[] = [];
  let resume = 0;
  for (const m of plain.matchAll(LIST)) {
    const start = (m.index ?? 0) + m[0].indexOf(m[1]);
    if (start < resume) continue;
    const count = COUNTS[m[1]];
    if (!count) continue;
    const listEnd = (m.index ?? 0) + m[0].length;
    const first = ordinal(plain, /(?:ا|و?ا)حد(?:هما|ها|هم)|(?:و?)الاول(?:ى)?/gu, listEnd, listEnd + TO_FIRST);
    if (!first) continue;

    const opening: { start: number; end: number }[] = [first];
    for (let n = 2; n <= count; n++) {
      const previous = opening[opening.length - 1];
      const word = new RegExp(`و?${ORDINALS[n]}(?:ة)?(?=[\\s:،.]|$)`, "gu");
      const next = ordinal(plain, word, previous.end, previous.end + VIEW_LENGTH);
      if (!next) break;
      opening.push(next);
    }
    // A list cut short would say there are fewer views than the book says.
    if (opening.length !== count) continue;

    const last = opening[opening.length - 1];
    const lineEnd = plain.indexOf("\n", last.end);
    const nextHead = taken.find((t) => t.pos > last.end)?.pos ?? plain.length;
    const end = Math.min(lineEnd < 0 ? plain.length : lineEnd, nextHead, last.end + 900);

    const views: View[] = opening.map((o, i) => {
      const to = i + 1 < opening.length ? opening[i + 1].start : end;
      const words2 = original(o.end, to).replace(/^[\s:：،.]+/u, "").trim();
      const here = plain.slice(o.end, to);
      const holders = holdersOf(here).map((h) => ({
        who: respelled(h.who, here, spelled.slice(o.end, to)),
        via: respelled(h.via, here, spelled.slice(o.end, to)),
      }));
      return { n: i + 1, text: words2, holders };
    });
    if (views.some((v) => !v.text)) continue;

    // What they differ on: back to where the sentence began.
    const lead = plain.slice(Math.max(0, start - 100), start);
    const from = Math.max(lead.lastIndexOf("."), lead.lastIndexOf("\n"), lead.lastIndexOf("﴾"), lead.lastIndexOf(":"), lead.lastIndexOf("؛"));
    const topic = original(Math.max(0, start - 100) + from + 1, listEnd).replace(/^[\s.،:]+/u, "");
    const head = [...taken].reverse().find((t) => t.pos <= start);
    out.push({
      topic,
      phrase: head?.found ? head.quote : "",
      at: head ? head.found : taken.length ? null : whole,
      views,
    });
    resume = end;
  }
  return out;
}
