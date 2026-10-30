/**
 * Where the Ḥanbalī jurists quote each ayah.
 *
 * Chapter nine of the ayah study sets the schools side by side. The Ḥanafī,
 * Shāfiʿī and Mālikī columns are books of aḥkām that go through the Qurʾān ayah
 * by ayah, and tafsir.app holds them. No Ḥanbalī book of that kind is there, and
 * the school's great works go by the chapters of fiqh instead. So this turns two
 * of them round: every place they quote an ayah, gathered under that ayah.
 *
 *   node scripts/build-fiqh.mjs         (npm run gen:fiqh)
 *
 * Writes, under public/fiqh/:
 *
 *   places/<surah>.json  for every ayah, each place it is quoted: the book, the
 *                        section, the volume and page of the printed edition,
 *                        the page on Shamela, the reference as the edition gives
 *                        it, the headings, and the paragraph the quotation is in;
 *   <book>/<n>.json      those sections whole, a few to a file, read only when a
 *                        reader asks for one.
 *
 * Nothing is matched by guess. The Shamela typing of these two editions marks
 * each quotation of the Qurʾān with its braces and its reference — «{وأشهدوا إذا
 * تبايعتم} [البقرة: 282]» — and a quotation is kept only where its words stand in
 * the ayah so named, compared by the skeleton `build-xref.mjs` uses. A phrase
 * found in several ayat stays under the one the edition names. A quotation the
 * edition gave no reference is not placed at all.
 *
 * The texts are read from OpenITI, which carries Shamela's typing with its page
 * marks, at a fixed commit. A mark there CLOSES its page: the words before
 * «PageV03P391» are on page 391 of volume 3, as Shamela's own pages show. So a
 * quotation's page is the first mark after it. The marks count Shamela's pages
 * too, which is what gives each place its link.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { AYAT, uthmani } from "./corpus-cache.mjs";

const CACHE = new URL("../node_modules/.cache/mishkat/", import.meta.url);
const OUT = new URL("../public/fiqh/", import.meta.url);

/** A file format number, read by `src/lib/ulum/fiqh.ts`. */
const FORMAT = 1;
/** Sections to a file, and read by `src/lib/ulum/fiqh.ts`. */
const BUCKET = 16;
/** Fewer letters than this in a quotation's skeleton and it could be anything. */
const LEAST_LETTERS = 3;
/** How far from the ayah named a quotation that runs over several may begin or end. */
const REACH = 4;

/** `firstPage` is Shamela's number for the file's first page mark. */
const WORKS = [
  {
    id: "almughni",
    firstPage: 0,
    url: "https://raw.githubusercontent.com/OpenITI/0625AH/f1e38210b32fd0d043949ff6471e869d658c3b16/data/0620IbnQudamaMaqdisi/0620IbnQudamaMaqdisi.Mughni/0620IbnQudamaMaqdisi.Mughni.Shamela0008463-ara1",
  },
  {
    id: "almubdi",
    firstPage: 1,
    url: "https://raw.githubusercontent.com/OpenITI/0900AH/271ff65bd8364d3a46b5806ca529617d1ffc3393/data/0884AbuIshaqIbnMuflih/0884AbuIshaqIbnMuflih.MubdicFiSharhMuqnic/0884AbuIshaqIbnMuflih.MubdicFiSharhMuqnic.Shamela0021619BK2-ara1",
  },
];

const SURAHS = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس", "هود",
  "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون",
  "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم", "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر",
  "يس", "الصافات", "ص", "الزمر", "غافر", "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح",
  "الحجرات", "ق", "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر",
  "الممتحنة", "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس", "التكوير",
  "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد", "الشمس", "الليل",
  "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات", "القارعة", "التكاثر", "العصر",
  "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر", "المسد", "الإخلاص", "الفلق", "الناس",
];
const SURAH = new Map(SURAHS.map((name, i) => [name, i + 1]));

async function textOf(work) {
  const file = new URL(`fiqh-${work.id}-${work.url.split("/")[5].slice(0, 8)}.txt`, CACHE);
  try {
    return await readFile(file, "utf8");
  } catch {
    const res = await fetch(work.url);
    if (!res.ok) throw new Error(`${res.status} for ${work.id}`);
    const text = await res.text();
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, text, "utf8");
    return text;
  }
}

// ── the skeleton ────────────────────────────────────────────────────────────

const ch = (code) => String.fromCodePoint(code);
const span = (a, b) => `${ch(a)}-${ch(b)}`;

/** The same skeleton `build-xref.mjs` compares quotations by; see the note there. */
const DROP = new RegExp(
  `[${[
    span(0x0610, 0x061a),
    span(0x064b, 0x065f),
    ch(0x0670),
    span(0x06d6, 0x06ed),
    ch(0x0640),
    ch(0x0627),
    span(0x0671, 0x0673),
    ch(0x0675),
    span(0x0621, 0x0626),
    ch(0x0649),
    ch(0x0648),
    ch(0x064a),
    ch(0x06cc),
  ].join("")}]`,
  "gu",
);
const NOT_LETTER = new RegExp(`[^${span(0x0621, 0x064a)}]`, "gu");
function skeleton(text) {
  const bare = text.replace(DROP, "").replaceAll(ch(0x0629), ch(0x062a)).replace(NOT_LETTER, "");
  let out = "";
  for (const c of bare) if (c !== out[out.length - 1]) out += c;
  return out;
}
/** Word by word, so that a doubled letter across two words stays two. */
const skeletonOf = (text) => text.split(/\s+/).map(skeleton).join("");

const uthmaniText = await uthmani();
const ayahSkeleton = AYAT.map((n, s) => Array.from({ length: n }, (_, a) => skeletonOf(uthmaniText[s][a])));
const of = (s, a) => ayahSkeleton[s - 1][a - 1] ?? "";

/** The ayat a quotation covers, from the reference the edition gives it; null if it does not stand there. */
function ayatOf(quote, s, a, b) {
  const last = AYAT[s - 1];
  if (a <= last && of(s, a).includes(quote)) return [a];
  for (let from = Math.max(1, a - REACH); from <= Math.min(last, b); from++) {
    let run = "";
    for (let to = from; to <= Math.min(last, b + REACH); to++) {
      run += of(s, to);
      if (to >= a && run.includes(quote)) return Array.from({ length: to - from + 1 }, (_, k) => from + k);
    }
  }
  return null;
}

// ── reading a book ──────────────────────────────────────────────────────────

const MARK = /\s*PageV(\d+)P(\d+)\s*/g;
const ARABIC = /[ء-ي]/;
const QUOTATION = /\{([^{}]*)\}\s*\[([^\]]{1,40})\]/g;
const REFERENCE = /^(.+?)\s*:\s*(\d+)(?:\s*-\s*(\d+))?\s*$/;

/**
 * The typing gives most headings a line of their own but runs some into the
 * text: «كتاب البيع والأصل فيه…». Such a paragraph has left the heading above it.
 * The titles of the books are named, since «كتاب» opens other paragraphs too.
 */
const RUN_IN_KITAB = /^(?:\(\d+\)\s*)?(كتاب (?:البيع|النكاح|الظهار|العارية|عشرة النساء والخلع))(?=[\s.:،]|$)/;
const RUN_IN = /^(?:\(\d+\)\s*)?(?:باب|فصل|مسألة)(?=[\s.:،؛]|$)/;

const tidy = (text) => text.replace(/\s*ms\d+\s*/g, " ").replace(/\s+/g, " ").trim();
/** A heading, without what is only punctuation at its two ends. */
const heading = (text) => tidy(text).replace(/^[\s\-–:ـ]+/, "").replace(/[\s،:.]+$/, "");
const unclosed = (text) => text.split("{").length > text.split("}").length;

/**
 * The book in sections, as the edition's headings cut it, each paragraph with
 * its text and the page marks inside it, by where they fall in that text.
 */
function read(raw, firstPage) {
  const lines = raw.slice(raw.indexOf("#META#Header#End")).split(/\r?\n/).slice(1);
  const sections = [];
  let section = null;
  let para = null;
  let kitab = "";
  const open = (head) => {
    section = { head, kitab, paras: [] };
    sections.push(section);
    para = null;
  };
  open("");
  for (const line of lines) {
    if (line.startsWith("### |")) {
      const head = heading(line.replace(/^### \|+/, ""));
      // The typing breaks a few quotations with a heading; it is the quotation going on.
      if (para && unclosed(para.raw)) para.raw += ` ${head}`;
      else if (ARABIC.test(head)) {
        if (/^\[?كتاب\s/.test(head)) kitab = head.replace(/^\[|\]$/g, "");
        open(head);
      }
    } else if (line.startsWith("# ")) {
      const raw = line.slice(2);
      const named = raw.match(RUN_IN_KITAB);
      if (named) kitab = named[1];
      const begun = section.paras.some((p) => tidy(p.raw.replace(MARK, " ")));
      if ((named || RUN_IN.test(raw)) && begun) open("");
      else if (named) section.kitab = kitab;
      para = { raw };
      section.paras.push(para);
    } else if (line.startsWith("~~") && para) {
      para.raw += ` ${line.slice(2)}`;
    }
  }

  // Each mark's place in its paragraph's clean text, then the page each mark closes.
  let serial = firstPage;
  for (const sec of sections) {
    for (const p of sec.paras) {
      p.marks = [];
      let text = "";
      let from = 0;
      const raw = p.raw;
      for (const m of raw.matchAll(MARK)) {
        text += `${raw.slice(from, m.index)} `;
        from = m.index + m[0].length;
        p.marks.push({ at: tidy(text).length, vol: +m[1], page: +m[2], shamela: serial++ });
      }
      p.text = tidy(text + raw.slice(from));
    }
    sec.paras = sec.paras.filter((p) => p.text || p.marks.length);
  }

  // Walking back, so that every paragraph knows the first mark after its end.
  let next = null;
  for (const sec of [...sections].reverse()) {
    for (const p of [...sec.paras].reverse()) {
      p.after = next;
      if (p.marks.length) next = p.marks[0];
    }
  }
  return sections;
}

function pageOf(para, at, last) {
  return para.marks.find((m) => m.at > at) ?? para.after ?? last;
}

// ── gathering the places ────────────────────────────────────────────────────

const places = AYAT.map(() => new Map());
const store = WORKS.map(() => []);

for (const [w, work] of WORKS.entries()) {
  const sections = read(await textOf(work), work.firstPage);
  const last = sections.flatMap((s) => s.paras).flatMap((p) => p.marks).at(-1);
  const count = { quotations: 0, whole: 0, running: 0, short: 0, unfound: 0, shared: 0, shifted: 0 };
  const covered = new Set();
  const numbers = new Map();

  for (const [i, sec] of sections.entries()) {
    const taken = new Set();
    for (const para of sec.paras) {
      for (const m of para.text.matchAll(QUOTATION)) {
        count.quotations++;
        const ref = m[2].match(REFERENCE);
        const s = ref && SURAH.get(ref[1].trim());
        if (!s) {
          count.unfound++;
          continue;
        }
        const quote = skeletonOf(m[1]);
        if (quote.length < LEAST_LETTERS) {
          count.short++;
          continue;
        }
        const a = +ref[2];
        const ayat = ayatOf(quote, s, a, +(ref[3] ?? ref[2]));
        if (!ayat) {
          count.unfound++;
          console.log(`  not in ${s}:${a}: ${m[1].slice(0, 60)}`);
          continue;
        }
        count[ayat.length > 1 ? "running" : "whole"]++;
        // How much the test proves: the same quotation, against the next ayah.
        if (a < AYAT[s - 1] && of(s, a + 1).includes(quote)) count.shifted++;
        if (ayahSkeleton.flat().filter((t) => t.includes(quote)).length > 1) count.shared++;

        for (const ayah of ayat) {
          covered.add(`${s}:${ayah}`);
          const once = `${s}:${ayah}`;
          if (taken.has(once)) continue;
          taken.add(once);
          if (!numbers.has(i)) {
            numbers.set(i, numbers.size);
            store[w].push(sec.paras.filter((p) => p.text).map((p) => p.text));
          }
          const page = pageOf(para, m.index, last);
          const row = [
            w,
            numbers.get(i),
            sec.paras.filter((p) => p.text).length,
            page.vol,
            page.page,
            page.shamela,
            m[2].trim(),
            sec.kitab,
            sec.head,
            para.text,
          ];
          const here = places[s - 1];
          if (!here.has(ayah)) here.set(ayah, []);
          here.get(ayah).push(row);
        }
      }
    }
  }
  console.log(work.id, `${sections.length} sections`, count, `${covered.size} ayat`, `${numbers.size} sections kept`);
  work.covered = covered;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(new URL("places/", OUT), { recursive: true });
let bytes = 0;
const write = async (rel, value) => {
  const body = JSON.stringify(value);
  bytes += Buffer.byteLength(body);
  await writeFile(new URL(rel, OUT), body, "utf8");
};
for (const [i, ayat] of places.entries()) {
  await write(`places/${i + 1}.json`, { format: FORMAT, ayat: Object.fromEntries(ayat) });
}
for (const [w, work] of WORKS.entries()) {
  await mkdir(new URL(`${work.id}/`, OUT), { recursive: true });
  for (let k = 0; k * BUCKET < store[w].length; k++) {
    const sections = {};
    store[w].slice(k * BUCKET, (k + 1) * BUCKET).forEach((paras, j) => (sections[k * BUCKET + j] = paras));
    await write(`${work.id}/${k}.json`, { format: FORMAT, sections });
  }
}
await writeFile(
  new URL("SOURCE.md", OUT),
  `# Where these files come from

They are worked out by \`scripts/build-fiqh.mjs\` from the digital text of two
Ḥanbalī works of fiqh, as held by the Open Islamicate Texts Initiative:

- **al-Mughnī** of Ibn Qudāma al-Maqdisī (d. 620 AH), Maktabat al-Qāhira, 1388/1968,
  ten volumes. OpenITI \`0620IbnQudamaMaqdisi.Mughni.Shamela0008463-ara1\`.
- **al-Mubdiʿ fī sharḥ al-Muqniʿ** of Burhān al-Dīn Ibn Mufliḥ (d. 884 AH), Dār
  al-Kutub al-ʿIlmiyya, 1418/1997, eight volumes. OpenITI
  \`0884AbuIshaqIbnMuflih.MubdicFiSharhMuqnic.Shamela0021619BK2-ara1\`.

Both were typed by al-Maktaba al-Shāmila (shamela.ws), whose page numbers the
links here follow. OpenITI publishes its corpus under Creative Commons
Attribution-NonCommercial-ShareAlike 4.0
(<https://creativecommons.org/licenses/by-nc-sa/4.0/>), and these files are
shared on the same terms. Cite it as: Romanov, Maxim, and Masoumeh Seydi,
"OpenITI: A Machine-Readable Corpus of Islamicate Texts", Zenodo,
doi:10.5281/zenodo.3082463. The change made here: the texts were cut into the
sections and paragraphs that quote the Qurʾān, and gathered under the ayat they
quote.

- \`places/<surah>.json\` — for every ayah, each place the books quote it.
- \`<book>/<n>.json\` — those sections whole, ${BUCKET} to a file.
`,
  "utf8",
);
const both = new Set(WORKS.flatMap((w) => [...w.covered]));
console.log(`${both.size} ayat in all, ${(bytes / 1e6).toFixed(2)} MB`);
