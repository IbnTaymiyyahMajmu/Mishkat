"use client";

import { useEffect, useState } from "react";
import { fetchTajweedPage } from "./api";

/**
 * Tajweed, as the corpus marks it.
 *
 * Each word comes with the places a rule of recitation applies wrapped in a
 * tag — `<rule class=ikhafa>نْ</rule>` — and this file reads those tags, says
 * what each rule is, and works out what a reader should do on stopping at the
 * end of a word.
 *
 * The rules are put in five families by what the reader's mouth does, which
 * is the thing a reader who finds the Qurʾān hard to read needs to know at a
 * glance: hold the vowel, take the sound through the nose, let the letter
 * bounce, run it into the next, or do not say it. The colours follow the ones
 * the printed tajweed muṣḥafs use — warm for the lengthenings, deepening with
 * the length; green for the nasal sounds; blue for the bounce; grey for what is
 * not said — so a reader who moves between this and a printed copy is not
 * taught twice.
 *
 * Every rule here is as Ḥafṣ reads from ʿĀṣim by way of al-Shāṭibiyyah, which
 * is the reading of the Madīnah muṣḥaf the text is taken from.
 */

export type Rule =
  | "madda_normal"
  | "madda_permissible"
  | "madda_obligatory_mottasel"
  | "madda_obligatory_monfasel"
  | "madda_necessary"
  | "ghunnah"
  | "ikhafa"
  | "ikhafa_shafawi"
  | "idgham_ghunnah"
  | "idgham_shafawi"
  | "iqlab"
  | "qalaqah"
  | "idgham_wo_ghunnah"
  | "idgham_mutajanisayn"
  | "idgham_mutaqaribayn"
  | "ham_wasl"
  | "laam_shamsiyah"
  | "slnt";

export type Family = "hold" | "nasal" | "bounce" | "merge" | "silent";

/** The colour a rule is drawn in: the lengthenings each by their length, the rest by family. */
export type Tone = "madd2" | "madd246" | "madd45" | "madd6" | "nasal" | "bounce" | "merge" | "silent";

export interface RuleInfo {
  family: Family;
  tone: Tone;
  /** The term, in Arabic, as the books of tajweed name it. */
  arabic: string;
  /** How long it is held, in counts: one choice, or the choices allowed. */
  counts?: number[];
}

export const RULES: Record<Rule, RuleInfo> = {
  madda_normal: { family: "hold", tone: "madd2", arabic: "المدّ الطبيعي", counts: [2] },
  madda_permissible: { family: "hold", tone: "madd246", arabic: "المدّ العارض للسكون", counts: [2, 4, 6] },
  madda_obligatory_mottasel: { family: "hold", tone: "madd45", arabic: "المدّ الواجب المتّصل", counts: [4, 5] },
  madda_obligatory_monfasel: { family: "hold", tone: "madd45", arabic: "المدّ الجائز المنفصل", counts: [4, 5] },
  madda_necessary: { family: "hold", tone: "madd6", arabic: "المدّ اللازم", counts: [6] },
  ghunnah: { family: "nasal", tone: "nasal", arabic: "الغنّة", counts: [2] },
  ikhafa: { family: "nasal", tone: "nasal", arabic: "الإخفاء", counts: [2] },
  ikhafa_shafawi: { family: "nasal", tone: "nasal", arabic: "الإخفاء الشفوي", counts: [2] },
  idgham_ghunnah: { family: "nasal", tone: "nasal", arabic: "الإدغام بغنّة", counts: [2] },
  idgham_shafawi: { family: "nasal", tone: "nasal", arabic: "الإدغام الشفوي", counts: [2] },
  iqlab: { family: "nasal", tone: "nasal", arabic: "الإقلاب", counts: [2] },
  qalaqah: { family: "bounce", tone: "bounce", arabic: "القلقلة" },
  idgham_wo_ghunnah: { family: "merge", tone: "merge", arabic: "الإدغام بغير غنّة" },
  idgham_mutajanisayn: { family: "merge", tone: "merge", arabic: "إدغام المتجانسين" },
  idgham_mutaqaribayn: { family: "merge", tone: "merge", arabic: "إدغام المتقاربين" },
  ham_wasl: { family: "silent", tone: "silent", arabic: "همزة الوصل" },
  laam_shamsiyah: { family: "silent", tone: "silent", arabic: "اللام الشمسية" },
  slnt: { family: "silent", tone: "silent", arabic: "حرف لا يُنطق" },
};

export const FAMILIES: Family[] = ["hold", "nasal", "bounce", "merge", "silent"];

/** The rules in the order a guide takes them: family by family, short to long. */
export const RULE_ORDER = Object.keys(RULES) as Rule[];

export function isRule(name: string): name is Rule {
  return name in RULES;
}

// ── the marking ─────────────────────────────────────────────────────────────

const cp = (...codes: number[]) => String.fromCodePoint(...codes);

/** The signs for where a reader may stop, and the brief pause without breath. */
export type Waqf = "lazim" | "la" | "jaiz" | "wasl" | "waqf" | "muanaqah" | "sakt";

const WAQF_OF: Record<string, Waqf> = {
  [cp(0x06d8)]: "lazim", // مـ — stop here
  [cp(0x06d9)]: "la", // لا — do not stop here
  [cp(0x06da)]: "jaiz", // ج — either
  [cp(0x06d6)]: "wasl", // صلى — reading on is better
  [cp(0x06d7)]: "waqf", // قلى — stopping is better
  [cp(0x06db)]: "muanaqah", // ∴ ∴ — at one of the two, not both
  [cp(0x06dc)]: "sakt", // س — a pause without breath
};

/** The mark itself, for showing it on its own. */
export const WAQF_MARK: Record<Waqf, string> = Object.fromEntries(
  Object.entries(WAQF_OF).map(([mark, w]) => [w, mark]),
) as Record<Waqf, string>;

export const WAQF_ORDER: Waqf[] = ["lazim", "waqf", "jaiz", "wasl", "la", "muanaqah", "sakt"];

const WAQF_RE = new RegExp(`[${Object.keys(WAQF_OF).join("")}]`, "g");

export interface Segment {
  text: string;
  rule?: Rule;
  waqf?: Waqf;
}

/**
 * A word's marking as runs of text, each with the rule it is under, if any.
 * Tags may nest (a dagger alif inside a lengthening); the innermost rule the
 * site knows is the one a run is drawn in. The signs for stopping are split
 * out to runs of their own, so that they can be explained.
 */
export function parseTajweed(markup: string): Segment[] {
  const out: Segment[] = [];
  const stack: (Rule | null)[] = [];
  const push = (text: string) => {
    if (!text) return;
    let rule: Rule | undefined;
    for (let i = stack.length - 1; i >= 0; i--) {
      const r = stack[i];
      if (r) {
        rule = r;
        break;
      }
    }
    let at = 0;
    for (const m of text.matchAll(WAQF_RE)) {
      const i = m.index ?? 0;
      if (i > at) out.push({ text: text.slice(at, i), rule });
      out.push({ text: m[0], waqf: WAQF_OF[m[0]] });
      at = i + m[0].length;
    }
    if (at < text.length) out.push({ text: text.slice(at), rule });
  };
  const re = /<rule class=["']?([\w-]+)["']?>|<\/rule>|<[^>]*>/g;
  let at = 0;
  for (const m of markup.matchAll(re)) {
    push(markup.slice(at, m.index));
    if (m[0] === "</rule>") stack.pop();
    else if (m[1] !== undefined) stack.push(isRule(m[1]) ? m[1] : null);
    at = (m.index ?? 0) + m[0].length;
  }
  push(markup.slice(at));
  // Runs under the same rule side by side are one run.
  return out.reduce<Segment[]>((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && !s.waqf && !last.waqf && last.rule === s.rule) last.text += s.text;
    else acc.push({ ...s });
    return acc;
  }, []);
}

/** The rules a word is under, in the order they come in it. */
export function rulesIn(markup: string): Rule[] {
  const seen: Rule[] = [];
  for (const s of parseTajweed(markup)) if (s.rule && !seen.includes(s.rule)) seen.push(s.rule);
  return seen;
}

/** The signs for stopping in a word. */
export function waqfIn(markup: string): Waqf[] {
  return parseTajweed(markup)
    .filter((s) => s.waqf)
    .map((s) => s.waqf as Waqf);
}

// ── stopping ────────────────────────────────────────────────────────────────

const FATHA = 0x064e;
const DAMMA = 0x064f;
const KASRA = 0x0650;
const SHADDA = 0x0651;
const SUKUN = 0x0652;
const SUKUN_UTHMANI = 0x06e1;
const FATHATAN = [0x064b, 0x08f0];
const DAMMATAN = [0x064c, 0x08f1];
const KASRATAN = [0x064d, 0x08f2];
const TA_MARBUTA = 0x0629;
const LONG = [0x0627, 0x0649, 0x0648, 0x064a]; // ا ى و ي
const QALQALAH = [0x0642, 0x0637, 0x0628, 0x062c, 0x062f]; // ق ط ب ج د

const isLetter = (c: number) => (c >= 0x0621 && c <= 0x064a) || c === 0x0671;

/** What changes at the end of a word when the reader stops on it. */
export type Stop = "an" | "ah" | "sukun" | "shadda" | "already" | "long" | "qalqalah" | "madd";

/**
 * What a reader does on stopping at a word, as the rules of waqf have it: the
 * last vowel falls away and the letter is silent; a tanwīn after a fatḥah
 * becomes a long ā; a tāʾ marbūṭah is said as a hāʾ; a doubled letter stays
 * doubled; a qalqalah letter bounces plainly; and a long vowel before the last
 * letter may be held two, four or six counts. Worked out from the word's own
 * letters and marks, so it is said for the word in front of the reader.
 */
export function stopping(markup: string): Stop[] {
  const text = markup.replace(/<[^>]*>/g, "");
  const codes = [...text].map((c) => c.codePointAt(0) as number);
  // The last letter, and the marks written on it.
  let i = codes.length - 1;
  while (i >= 0 && !isLetter(codes[i])) i--;
  if (i < 0) return [];
  const letter = codes[i];
  const marks = codes.slice(i + 1);
  let before = i - 1;
  while (before >= 0 && !isLetter(codes[before])) before--;
  const marksOf = (at: number) => {
    const out: number[] = [];
    for (let k = at + 1; k < codes.length && !isLetter(codes[k]); k++) out.push(codes[k]);
    return out;
  };
  const has = (list: number[], ...want: number[]) => want.some((w) => list.includes(w));

  const out: Stop[] = [];
  const rules = rulesIn(markup);
  if (rules.includes("madda_permissible")) out.push("madd");

  // An alif or alif maqṣūrah carrying no vowel of its own after a tanwīn: the
  // tanwīn of fatḥ, whose stop is a long ā.
  if ((letter === 0x0627 || letter === 0x0649) && !has(marks, FATHA, DAMMA, KASRA, SUKUN, SUKUN_UTHMANI) && before >= 0) {
    const prev = marksOf(before);
    if (has(prev, ...FATHATAN)) return [...out, "an"];
    // Otherwise the word ends on its long vowel, which is held as it is.
    if (!out.includes("madd")) out.push("long");
    return out;
  }
  // A tāʾ marbūṭah is a hāʾ on stopping, whatever its vowel or tanwīn.
  if (letter === TA_MARBUTA) return [...out, "ah"];
  if (has(marks, ...FATHATAN)) return [...out, "an"];

  // A wāw or yāʾ with no mark after a matching vowel is a long vowel too.
  if (LONG.includes(letter) && !marks.some((m) => m >= 0x064b && m <= 0x0652) && !has(marks, SUKUN_UTHMANI)) {
    if (!out.includes("madd")) out.push("long");
    return out;
  }

  if (has(marks, SUKUN, SUKUN_UTHMANI)) out.push("already");
  else if (has(marks, FATHA, DAMMA, KASRA, ...DAMMATAN, ...KASRATAN)) out.push("sukun");
  if (has(marks, SHADDA)) out.push("shadda");
  if (QALQALAH.includes(letter)) out.push("qalqalah");
  return out;
}

// ── the surah's marking, laid over its text ─────────────────────────────────

/** For each ayah, each word's marking by its position (from 1). */
export type SurahTajweed = Map<string, string[]>;

/**
 * The tajweed of a surah, for colouring a text already on screen, or null
 * while it is not wanted or has not come. Read a page of fifty ayat at a
 * time, each laid on as it arrives, as the text itself is.
 */
export function useSurahTajweed(surah: number, on: boolean): SurahTajweed | null {
  const [held, setHeld] = useState<{ surah: number; map: SurahTajweed } | null>(null);

  useEffect(() => {
    if (!on) return;
    let alive = true;
    (async () => {
      let map: SurahTajweed = new Map();
      for (let page = 1, total = 1; page <= total; page++) {
        const next = await fetchTajweedPage(surah, page);
        if (!alive) return;
        total = next.totalPages;
        map = new Map(map);
        for (const v of next.verses) {
          const words: string[] = [];
          for (const w of v.words) if (w.char_type_name === "word") words[w.position] = w.text_uthmani_tajweed ?? "";
          map.set(v.verse_key, words);
        }
        setHeld({ surah, map });
      }
    })().catch(() => {
      /* the text stays uncoloured; nothing the reader needs is missing */
    });
    return () => {
      alive = false;
    };
  }, [surah, on]);

  return on && held?.surah === surah ? held.map : null;
}

/** How many words in a surah each family is found in, for the legend. */
export function familyCounts(map: SurahTajweed): Record<Family, number> {
  const out: Record<Family, number> = { hold: 0, nasal: 0, bounce: 0, merge: 0, silent: 0 };
  for (const words of map.values()) {
    for (const markup of words) {
      if (!markup) continue;
      const fams = new Set(rulesIn(markup).map((r) => RULES[r].family));
      for (const f of fams) out[f]++;
    }
  }
  return out;
}
