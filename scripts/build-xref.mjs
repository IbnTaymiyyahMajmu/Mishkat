/**
 * The Qurʾān explained by the Qurʾān: which ayat the commentators bring to
 * explain which.
 *
 * Every work in the library quotes the Qurʾān as it explains it, and the copy
 * marks each quotation the way the printed editions do — ﴿…﴾ — very often with
 * the place it is from beside it: [الشعراء: ٢٣، ٢٤]. Read across the works the
 * site may quote from (the list `scripts/lock-intros.mjs` holds), that is an
 * index nobody has to write: for each ayah, the others its commentators
 * reached for to explain it.
 *
 *   node scripts/build-xref.mjs          (npm run gen:xref)
 *   node scripts/build-xref.mjs --stats  measure, write nothing
 *
 * ── how a quotation is placed ─────────────────────────────────────────────
 *
 * The editions quote in the spelling of their day, and the muṣḥaf is in its
 * own: الصلاة against ٱلصَّلَوٰةَ, السماوات against ٱلسَّمَٰوَٰتِ, يا أيها against
 * يَٰٓأَيُّهَا. So both are reduced to a skeleton before they are compared —
 * the consonants, without vowels, without the long vowels and the hamza's
 * seats that the two spellings disagree on, without spaces, with a doubled
 * letter written once. What survives is the part of a word both spellings
 * agree on, and a quotation of any length is found in very few places by it.
 * The muṣḥaf's skeleton is one unbroken string, so a quotation that runs on
 * from one ayah into the next is found as easily as one inside an ayah.
 *
 * A quotation is then placed:
 *
 *   - where the edition says it is from, if its words are found there. The
 *     editions say so in four ways — [الشعراء: ٢٣], (الإسراء: ٢٧),
 *     (٨٧-الحجر), and a footnote, [[سورة يوسف آية ١٧]] — and the editor's
 *     reference is the strongest evidence there is;
 *   - otherwise, where its words are found once in the whole muṣḥaf;
 *   - and nowhere, if they are found in several places. A guess between two
 *     ayat with the same words would be a claim the commentator did not make.
 *
 * A quotation of the passage being explained is the commentator reading his
 * text, not reaching for another, and is not counted; nor is one of the ayah
 * on either side of it, which is the commentator reading on.
 *
 * ── what is written ───────────────────────────────────────────────────────
 *
 * `public/xref/<surah>.json`, one file to a surah, holding both directions:
 *
 *   out   for each passage of a work on this surah, the ayat it quotes, where
 *         in the passage each quotation stands — so the screen can show the
 *         commentator's own sentence around it, read from the copy — and
 *         which ayah of the passage he was explaining when he quoted it;
 *   in    for each ayah of this surah, the places elsewhere that quote it.
 *
 * Ayat are numbered from 1 to 6,236 across the whole muṣḥaf, to keep the
 * files small; `src/lib/quran/xref.ts` reads them back.
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { AYAT, ayahAt, ayahIndex, uthmani } from "./corpus-cache.mjs";

const STATS = process.argv.includes("--stats");
const SAMPLE = process.argv.includes("--sample");
const TAFSIR = new URL("../public/tafsir/", import.meta.url);
const OUT = new URL("../public/xref/", import.meta.url);

/**
 * The works whose quotations are read, in the order the screen lists them:
 * the work written to explain the Qurʾān by the Qurʾān first, then the rest
 * oldest to newest. The same works the introductions may quote — `QUOTABLE`
 * in scripts/lock-intros.mjs — and no others.
 */
const WORKS = [
  "adwaa-albayan",
  "tabari",
  "baghawi",
  "zad-almaseer",
  "qurtubi",
  "ibn-alqayyim",
  "ibn-katheer",
  "aldur-almanthoor",
  "fath-alqadeer",
  "ibn-uthaymeen",
  "mukhtasar",
];

/** How far from the passage a quotation of the same surah is still "reading on". */
const NEAR = 2;
/** Below this many letters of skeleton, a quotation without a reference is a phrase, and phrases recur. */
const LEAST = 7;

if (AYAT.reduce((a, b) => a + b, 0) !== 6236) throw new Error("the count of ayat is not 6,236");

// ── the skeleton ────────────────────────────────────────────────────────────

const ch = (code) => String.fromCodePoint(code);
const span = (a, b) => `${ch(a)}-${ch(b)}`;

/**
 * Everything the two spellings disagree on: the vowels and the Qurʾānic marks,
 * the tatweel, the alifs in all their forms, the hamza and its seats, and wāw
 * and yāʾ, which the muṣḥaf writes small, or large, or not at all, where the
 * editions write them in full.
 */
const DROP = new RegExp(
  `[${[
    span(0x0610, 0x061a), // marks above and below
    span(0x064b, 0x065f), // the vowels, tanwīn, shaddah, sukūn
    ch(0x0670), //            the dagger alif
    span(0x06d6, 0x06ed), // the muṣḥaf's own marks: pauses, small wāw and yāʾ
    ch(0x0640), //            tatweel
    ch(0x0627), //            alif
    span(0x0671, 0x0673), // alif waṣlah and its kin
    ch(0x0675),
    span(0x0621, 0x0626), // hamza, and alif, wāw and yāʾ carrying it
    ch(0x0649), //            alif maqṣūrah
    ch(0x0648), //            wāw
    ch(0x064a), //            yāʾ
    ch(0x06cc), //            Persian yāʾ
  ].join("")}]`,
  "gu",
);
const NOT_LETTER = new RegExp(`[^${span(0x0621, 0x064a)}]`, "gu");

/** The consonants both spellings agree on. See the note at the head of the file. */
function skeleton(text) {
  const bare = text
    .replace(DROP, "")
    .replaceAll(ch(0x0629), ch(0x062a)) // tāʾ marbūṭah, which the muṣḥaf often writes open
    .replaceAll(ch(0x06a9), ch(0x0643)) // a kāf from a Persian keyboard
    .replace(NOT_LETTER, "");
  let out = "";
  for (const c of bare) if (c !== out[out.length - 1]) out += c;
  return out;
}

// ── the muṣḥaf, as one skeleton ─────────────────────────────────────────────

const text = await uthmani();
let joined = "";
/** Where each ayah's skeleton begins in `joined`, by its index from 1. */
const starts = [];
for (let s = 1; s <= 114; s++) {
  for (let a = 1; a <= AYAT[s - 1]; a++) {
    starts[ayahIndex(s, a)] = joined.length;
    joined += skeleton(text[s - 1][a - 1]);
  }
}
starts[6237] = joined.length;

/** Which ayah a position in `joined` belongs to. */
function ayahOf(pos) {
  let lo = 1;
  let hi = 6236;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const GRAM = 5;
const grams = new Map();
for (let i = 0; i + GRAM <= joined.length; i++) {
  const g = joined.slice(i, i + GRAM);
  const list = grams.get(g);
  if (list) list.push(i);
  else grams.set(g, [i]);
}

/** Every stretch of ayat whose skeleton holds this one: [first, last], by index. */
function found(q) {
  if (q.length < GRAM) return [];
  const out = new Map();
  for (const pos of grams.get(q.slice(0, GRAM)) ?? []) {
    if (!joined.startsWith(q, pos)) continue;
    const first = ayahOf(pos);
    const last = ayahOf(pos + q.length - 1);
    out.set(`${first}-${last}`, [first, last]);
  }
  return [...out.values()];
}

// ── the editions' references ────────────────────────────────────────────────

const DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toNumber = (s) => Number([...s].map((c) => (DIGITS.includes(c) ? DIGITS.indexOf(c) : c)).join(""));

const MARKS = new RegExp(`[${[span(0x0610, 0x061a), span(0x064b, 0x065f), ch(0x0670), span(0x06d6, 0x06ed), ch(0x0640)].join("")}]`, "gu");
const ALIFS = new RegExp(`[${[ch(0x0622), ch(0x0623), ch(0x0625), ch(0x0671)].join("")}]`, "gu");

/**
 * A surah's name as an edition writes it, without its vowels, its article or
 * the word "sūrah". Not the skeleton: النساء and الناس have the same one.
 */
const nameKey = (name) =>
  name
    .replace(MARKS, "")
    .replace(ALIFS, ch(0x0627))
    .replaceAll(ch(0x0649), ch(0x064a))
    .replaceAll(ch(0x0629), ch(0x0647))
    .replace(/^\s*سورة\s+/u, "")
    .replace(/^ال/u, "")
    .replace(/\s+/gu, "");

const NAMES = new Map();
{
  const source = await readFile(new URL("../src/lib/quran/surahNames.ts", import.meta.url), "utf8");
  const arabic = [...source.matchAll(/arabic: "([^"]+)"/g)].map((m) => m[1]);
  if (arabic.length !== 114) throw new Error(`read ${arabic.length} surah names, not 114`);
  arabic.forEach((name, i) => {
    const key = nameKey(name);
    if (NAMES.has(key)) throw new Error(`${name} and surah ${NAMES.get(key)} read as the same name`);
    NAMES.set(key, i + 1);
  });
  // The other names the editions use, and a few they misspell.
  const also = {
    براءة: 9, "بني إسرائيل": 17, سبحان: 17, المؤمن: 40, "حم السجدة": 41, فصلت: 41, السجدة: 32, القتال: 47,
    الدهر: 76, "هل أتى": 76, الإنسان: 76, تبارك: 67, الملك: 67, القلم: 68, "ن": 68, "عم": 78, النبأ: 78, تبت: 111,
    اللهب: 111, المسد: 111, الإخلاص: 112, "ألم نشرح": 94, الانشراح: 94, الشرح: 94, "اقرأ": 96, العلق: 96,
    البينة: 98, "لم يكن": 98, "ق": 50, "ص": 38, الأعلى: 87, سبح: 87, الزلزلة: 99, الزلزال: 99, إبراهيم: 14,
    الأحراب: 33, فضلت: 41, الصاقات: 37,
  };
  for (const [name, n] of Object.entries(also)) NAMES.set(nameKey(name), n);
}

/** A reference, once its surah's name and its numbers are read out of it. */
function place(name, numbers) {
  const surah = NAMES.get(nameKey(name));
  if (!surah) return null;
  const ayat = [...numbers.matchAll(/[٠-٩0-9]{1,3}/gu)].map((x) => toNumber(x[0])).filter((n) => n >= 1 && n <= AYAT[surah - 1]);
  if (!ayat.length) return null;
  return { first: ayahIndex(surah, Math.min(...ayat)), last: ayahIndex(surah, Math.max(...ayat)) };
}

const NUMS = "([٠-٩0-9]{1,3}(?:\\s*[-–،,و]\\s*[٠-٩0-9]{1,3})*)";
/** [الشعراء: ٢٣، ٢٤] · (الإسراء: ٢٧) — the name, then the numbers. */
const NAME_FIRST = new RegExp(`^\\s*[.،,]?\\s*[(\\[]\\s*([^\\]):\\d٠-٩]{1,24}?)\\s*:\\s*${NUMS}\\s*[\\])]`, "u");
/** (٨٧-الحجر) — the number, then the name. */
const NUMBER_FIRST = new RegExp(`^\\s*[.،,]?\\s*\\(\\s*${NUMS}\\s*-\\s*([^)\\d٠-٩]{2,24}?)\\s*\\)`, "u");
/** [[سورة يوسف آية ١٧.]] — the editor's footnote, which al-Qurṭubī's edition puts inside the quotation. */
const FOOTNOTE = new RegExp(`\\[\\[\\s*(?:سورة|سُورَةُ)\\s+([^\\]،,]{1,24}?)\\s*[،,]?\\s*(?:الآية|آية|آيه)\\s*:?\\s*${NUMS}`, "u");

/** Where the edition says a quotation is from, looking at what follows it and what is in it. */
function reference(inside, after) {
  let m = NAME_FIRST.exec(after);
  if (m) return place(m[1], m[2]);
  m = NUMBER_FIRST.exec(after);
  if (m) return place(m[2], m[1]);
  m = FOOTNOTE.exec(inside) ?? FOOTNOTE.exec(after.slice(0, 60));
  if (m) return place(m[1], m[2]);
  return null;
}

// ── reading the works ───────────────────────────────────────────────────────

/** ﴿…﴾ throughout the library; and in al-Qurṭubī's edition, "…" with a footnote saying where. */
const BRACED = /﴿([^﴾]{1,1600})﴾/gu;
const QUOTED = /"([^"]{3,600})"/gu;

const stats = { quotes: 0, referenced: 0, refWords: 0, unique: 0, ambiguous: 0, short: 0, none: 0, own: 0, near: 0 };
const samples = {};
function sample(kind, line) {
  if (!SAMPLE || Math.random() > 0.004) return;
  (samples[kind] ??= []).push(line);
}

/** out[surah] = passages: [work, from, to, [target, at, ayah, target, at, ayah, …]] */
const out = Array.from({ length: 115 }, () => []);
/** into[target] = [[work, sourceIndex, at], …] */
const into = Array.from({ length: 6237 }, () => []);

for (const [w, work] of WORKS.entries()) {
  const dir = new URL(`${work}/`, TAFSIR);
  let names;
  try {
    names = (await readdir(dir)).filter((f) => /^\d+-\d+\.json$/.test(f));
  } catch {
    console.warn(`${work}: not in the copy, skipped`);
    continue;
  }
  let edges = 0;
  for (const name of names) {
    const { surah, passages } = JSON.parse(await readFile(new URL(name, dir), "utf8"));
    for (const [from, to, body] of passages) {
      const first = ayahIndex(surah, from);
      const last = ayahIndex(surah, to);
      const ownOrNear = (h) => h >= first - NEAR && h <= last + NEAR && ayahAt(h)[0] === surah;
      const refs = new Map();
      // A passage on several ayat goes through them in turn, quoting each as it
      // reaches it — "and His saying: ﴿…﴾" — before saying what it means. The
      // ayah last quoted is the one under discussion, and an ayah brought in
      // from elsewhere is brought in to explain that one, not the whole run.
      let discussed = first;

      const quotations = [...body.matchAll(BRACED)];
      if (work === "qurtubi") {
        for (const m of body.matchAll(QUOTED)) if (FOOTNOTE.test(m[1])) quotations.push(m);
        quotations.sort((a, b) => a.index - b.index);
      }

      for (const m of quotations) {
        stats.quotes++;
        const at = m.index;
        const words = m[1].replace(/\[\[[^\]]*\]\]/gu, " ");
        const after = body.slice(at + m[0].length, at + m[0].length + 80);
        const ref = reference(m[1], after);
        const q = skeleton(words);
        let hits = found(q);
        // A quotation that runs over ayat the edition did not print together —
        // two ayat joined by an asterisk, but not adjacent — is read in pieces.
        if (!hits.length && /\*/u.test(words)) {
          hits = words
            .split("*")
            .map(skeleton)
            .filter((piece) => piece.length >= LEAST)
            .flatMap((piece) => {
              const h = found(piece);
              return h.length === 1 ? h : [];
            });
        }

        const own = hits.filter(([a, b]) => b >= first && a <= last).map(([a]) => Math.max(a, first));
        if (own.length) discussed = Math.min(...own);

        let placed;
        if (ref) {
          const there = hits.filter(([a, b]) => b >= ref.first - 1 && a <= ref.last + 1);
          if (there.length) {
            stats.referenced++;
            placed = there;
          } else {
            // The words were not found where the editor says — usually a
            // reading or a spelling the skeleton does not reconcile. The
            // editor is believed over the spelling.
            stats.refWords++;
            placed = [[ref.first, ref.last]];
          }
        } else if (q.length < LEAST) {
          stats.short++;
          continue;
        } else if (hits.length === 1) {
          stats.unique++;
          placed = hits;
        } else if (hits.length > 1) {
          if (hits.some(([a, b]) => ownOrNear(a) || ownOrNear(b))) stats.own++;
          else {
            stats.ambiguous++;
            sample("several", `${work} ${surah}:${from} ﴿${m[1].slice(0, 70)}﴾ → ${hits.map(([a]) => ayahAt(a).join(":")).join(", ")}`);
          }
          continue;
        } else {
          stats.none++;
          sample("none", `${work} ${surah}:${from} ﴿${m[1].slice(0, 90)}﴾`);
          continue;
        }

        for (const [a, b] of placed) {
          for (let h = a; h <= b; h++) {
            if (ownOrNear(h)) {
              stats[h >= first && h <= last ? "own" : "near"]++;
              continue;
            }
            const slot = `${h}|${discussed}`;
            if (refs.has(slot)) continue;
            refs.set(slot, [h, at, discussed]);
            sample("placed", `${work} ${surah}:${from}-${to} → ${ayahAt(h).join(":")}${ref ? " (ref)" : ""} ﴿${m[1].slice(0, 70)}﴾`);
          }
        }
      }

      if (!refs.size) continue;
      const flat = [];
      for (const [target, at, about] of refs.values()) {
        flat.push(target, at, about - first + from);
        into[target].push([w, about, at]);
        edges++;
      }
      out[surah].push([w, from, to, flat]);
    }
  }
  console.log(`${work}: ${edges.toLocaleString("en")} ayat quoted from elsewhere`);
}

console.log(
  [
    `quotations read ${stats.quotes}`,
    `placed by the edition's reference ${stats.referenced} (and on its word alone ${stats.refWords})`,
    `by their words ${stats.unique}`,
    `left, found in several places ${stats.ambiguous}`,
    `left, too short ${stats.short}`,
    `not found ${stats.none}`,
    `of the passage itself ${stats.own}`,
    `of its neighbours ${stats.near}`,
  ].join("\n  "),
);
if (SAMPLE) console.log(JSON.stringify(samples, null, 1));
if (STATS || SAMPLE) process.exit(0);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
let bytes = 0;
let largest = 0;
for (let s = 1; s <= 114; s++) {
  const inbound = {};
  for (let a = 1; a <= AYAT[s - 1]; a++) {
    const list = into[ayahIndex(s, a)];
    if (list.length) inbound[a] = list.flat();
  }
  const file = JSON.stringify({ v: 1, surah: s, works: WORKS, out: out[s], in: inbound });
  bytes += file.length;
  largest = Math.max(largest, file.length);
  await writeFile(new URL(`${s}.json`, OUT), file, "utf8");
}
console.log(`wrote public/xref — ${(bytes / 1e6).toFixed(1)} MB in 114 files, the largest ${(largest / 1e3).toFixed(0)} KB`);
