import { chainOf } from "./read";
import { bare, plainMap } from "./skeleton";

/**
 * Saying that a report is weak, and why, and who says so.
 *
 * Nothing here is a grading of the page's own. A report is marked in one of three
 * ways, and each says which:
 *
 *   an editor's note   the note in the copy says it of this report: «إسناده ضعيف»;
 *   al-Suyūṭī          his account of the routes from Ibn ʿAbbās in al-Itqān
 *                      (4:239), where the chain is one of those he names;
 *   the chain itself   it does not name a link: «حدثت عن…», «عن رجل».
 *
 * A report none of these speaks of is not thereby sound. The page goes on saying
 * it is not graded here.
 */

export type WeakKind = "falsehood" | "fabricated" | "veryWeak" | "weak" | "interrupted" | "mursal" | "rejected" | "unnamed";
export type WeakRoute = "falsehood" | "kalbi" | "juwaybir" | "bishr" | "dahhak" | "awfi";

export interface Weak {
  kind: WeakKind;
  /** Whether what is wrong is its chain or what it says. */
  aspect: "chain" | "text";
  /** The source's own words for it. */
  words: string;
  /** Which of al-Suyūṭī's routes, where it is one. */
  route?: WeakRoute;
  by: "itqan" | "editor" | "chain";
}

const plainOf = (text: string) => bare(text).replace(/[أإآ]/g, "ا");

const TO_IBN_ABBAS = /عن\s+ابن\s+عباس[\s،,.]*$/u;

/** Al-Suyūṭī's weak routes from Ibn ʿAbbās, the worst first, in his words (al-Itqān 4:239). */
const ROUTES: { route: WeakRoute; kind: WeakKind; words: string; test: (chain: string) => boolean }[] = [
  {
    route: "falsehood",
    kind: "falsehood",
    words: "فإن انضم إلى ذلك رواية محمد بن مروان السدي الصغير فهي سلسلة الكذب",
    test: (c) => /الكلبي/u.test(c) && /محمد\s+بن\s+مروان/u.test(c),
  },
  {
    route: "kalbi",
    kind: "veryWeak",
    words: "وأوهى طرقه طريق الكلبي عن أبي صالح عن ابن عباس",
    test: (c) => /الكلبي[^،,]{0,10}[،,]?\s*عن\s+ابي\s+صالح/u.test(c),
  },
  {
    route: "juwaybir",
    kind: "veryWeak",
    words: "وإن كان من رواية جويبر عن الضحاك فأشد ضعفا لأن جويبرا شديد الضعف متروك",
    test: (c) => /جويبر/u.test(c) && /الضحاك/u.test(c),
  },
  {
    route: "bishr",
    kind: "weak",
    words: "فإن انضم إلى ذلك رواية بشر بن عمارة عن أبي روق عنه فضعيفة لضعف بشر",
    test: (c) => /بشر\s+بن\s+عمارة/u.test(c) && /الضحاك/u.test(c),
  },
  {
    route: "dahhak",
    kind: "interrupted",
    words: "وطريق الضحاك بن مزاحم عن ابن عباس منقطعة فإن الضحاك لم يلقه",
    test: (c) => /الضحاك[^،,]{0,14}[،,]?\s*عن\s+ابن\s+عباس/u.test(c),
  },
  {
    route: "awfi",
    kind: "weak",
    words: "والعوفي ضعيف ليس بواه",
    test: (c) =>
      /العوفي/u.test(c) ||
      /عطية[^،,]{0,10}[،,]?\s*عن\s+ابن\s+عباس/u.test(c) ||
      /محمد\s+بن\s+سعد[\s\S]{0,80}عمي[\s\S]{0,60}عن\s+ابيه[،,]?\s*عن\s+ابن\s+عباس/u.test(c),
  },
];

/** A chain's route from Ibn ʿAbbās, if it is one al-Suyūṭī calls weak. */
function onRoute(chain: string): Weak | null {
  if (!TO_IBN_ABBAS.test(chain)) return null;
  const hit = ROUTES.find((r) => r.test(chain));
  return hit ? { kind: hit.kind, aspect: "chain", words: hit.words, route: hit.route, by: "itqan" } : null;
}

/** «رواه العوفي عن ابن عباس» in a book's list of views: the same routes, by the names it gives. */
export function weakRoute(via: string, who: string): Weak | null {
  return via ? onRoute(plainOf(`عن ${via} عن ${who}`)) : null;
}

/** The same routes as a book's running text names them. */
const IN_TEXT: { route: WeakRoute; re: RegExp }[] = [
  { route: "kalbi", re: /الكلبي[^.؛\n]{0,14}عن\s+ابي\s+صالح[^.؛\n]{0,14}عن\s+ابن\s+عباس/gu },
  { route: "juwaybir", re: /جويبر[^.؛\n]{0,40}الضحاك[^.؛\n]{0,20}عن\s+ابن\s+عباس/gu },
  { route: "bishr", re: /بشر\s+بن\s+عمارة[^.؛\n]{0,70}عن\s+ابن\s+عباس/gu },
  { route: "dahhak", re: /الضحاك[^.؛\n]{0,14}عن\s+ابن\s+عباس/gu },
  { route: "awfi", re: /العوفي[^.؛\n]{0,14}عن\s+ابن\s+عباس/gu },
];

/** Where a stretch of a book's text names a weak route, by where it stands in the text. */
export function weakSpans(text: string): { from: number; to: number; weak: Weak }[] {
  if (!/ع[\u064B-\u0652]*ب[\u064B-\u0652]*[\u0651]?[\u064B-\u0652]*ا[\u064B-\u0652]*س/u.test(text)) return [];
  const { plain, at } = plainMap(text);
  const out: { from: number; to: number; weak: Weak }[] = [];
  for (const { route, re } of IN_TEXT) {
    for (const m of plain.matchAll(re)) {
      const from = at[m.index ?? 0];
      const to = at[(m.index ?? 0) + m[0].length - 1] + 1;
      if (out.some((o) => from < o.to && to > o.from)) continue;
      const known = ROUTES.find((r) => r.route === route);
      if (known) out.push({ from, to, weak: { kind: known.kind, aspect: "chain", words: known.words, route, by: "itqan" } });
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

const UNNAMED =
  /(?:^|[\s،,])(حدثت\s+عن|حدثت\s|عن\s+رجل|عن\s+شيخ|عمن\s|عن\s+من\s|عن\s+بعض\s|عن\s+فلان|حدثني\s+رجل|اخبرني\s+رجل|حدثني\s+من\s|اخبرني\s+من\s|ثني\s+رجل|ثنا\s+رجل|ثني\s+من\s|ثنا\s+من\s|سمعت\s+رجلا|بلغني|بلغنا)/u;

const VERDICT =
  /(اسناده|اسنادها|اسنادهما|اسناد\s+هذا|هذا\s+اسناد|هذا\s+الاسناد|هذا\s+(?:خبر|حديث|اثر)|هو\s+(?:خبر|حديث))[^.؛]{0,70}?(ضعيف\s+جدا|ضعيفان|ضعيف|واه|منقطع|معضل|مرسل|موضوع|لا\s+اصل\s+له|باطل|منكر)/u;
const KINDS: Record<string, WeakKind> = {
  ضعيفان: "weak",
  ضعيف: "weak",
  "ضعيف جدا": "veryWeak",
  واه: "veryWeak",
  منقطع: "interrupted",
  معضل: "interrupted",
  مرسل: "mursal",
  موضوع: "fabricated",
  باطل: "fabricated",
  "لا اصل له": "fabricated",
  منكر: "rejected",
};

const DIGITS = /[٠-٩\d]+/gu;
const latin = (n: string) => n.replace(/[٠-٩]/gu, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** That a report raised to the Prophet ﷺ is graded in the copy, and how. */
export interface NoteGrade {
  sound: boolean;
  words: string;
}

const SOUND = /(اسناده|اسنادها|هذا\s+اسناد|هذا\s+الاسناد|هذا\s+حديث|حديث)[^.؛]{0,50}?(صحيح|حسن)/u;

/** What the editor's note says of this report, sound or weak; null where it does not grade it. */
export function noteGrade(report: string): NoteGrade | null {
  const weak = fromNote(report);
  if (weak) return { sound: false, words: weak.words };
  const own = /^\s*([٠-٩\d]{1,6})/u.exec(report)?.[1];
  for (const m of report.matchAll(/\[\[([\s\S]*?)\]\]/g)) {
    if (!aboutThis(m[1], own)) continue;
    for (const sentence of m[1].split(/(?<=[.؛])\s*/u)) {
      if (SOUND.test(plainOf(sentence))) return { sound: true, words: bare(sentence).replace(/\s+/gu, " ").trim().slice(0, 260) };
    }
  }
  return null;
}

/** A note that names a report by its number is about that report and no other. */
function aboutThis(note: string, own: string | undefined): boolean {
  const named = (/^\s*(?:الحديث|الخبران|الخبر|الأثران|الأثر)[^٠-٩\d]{0,8}((?:[٠-٩\d]+[،,\s-]*)+)/u.exec(note)?.[1].match(DIGITS) ?? []).map(latin);
  return !named.length || (!!own && named.includes(latin(own)));
}

/**
 * What an editor's note in the copy says of this report, if it says it is weak.
 * A note that names a report by its number is about that report and no other: the
 * copies do not always keep a note beside the report it belongs to.
 */
function fromNote(report: string): Weak | null {
  const own = /^\s*([٠-٩\d]{1,6})/u.exec(report)?.[1];
  for (const m of report.matchAll(/\[\[([\s\S]*?)\]\]/g)) {
    if (!aboutThis(m[1], own)) continue;
    for (const sentence of m[1].split(/(?<=[.؛])\s*/u)) {
      const hit = VERDICT.exec(plainOf(sentence));
      if (!hit || /صحيح|حسن/u.test(hit[0])) continue;
      return {
        kind: KINDS[hit[2].replace(/\s+/gu, " ")] ?? "weak",
        aspect: /اسناد/u.test(hit[1]) ? "chain" : "text",
        words: bare(sentence).replace(/\s+/gu, " ").trim().slice(0, 260),
        by: "editor",
      };
    }
  }
  return null;
}

/** Whether a report is marked weak, by whom, and why; null where nothing here says so. */
export function weakOf(report: string): Weak | null {
  const noted = fromNote(report);
  if (noted) return noted;
  const chain = chainOf(report.replace(/\[\[[\s\S]*?\]\]/g, " "));
  const routed = onRoute(chain);
  if (routed) return routed;
  const unnamed = UNNAMED.exec(chain);
  return unnamed ? { kind: "unnamed", aspect: "chain", words: unnamed[1].trim(), by: "chain" } : null;
}
