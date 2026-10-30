/**
 * What al-Rāzī, Abū al-Suʿūd and Ibn ʿĀshūr say of each surah, for its introduction.
 *
 * The owner asked for the three to be added to the introductions. Each is taken
 * for what he states and nothing else, so that nothing here is written by the site:
 *
 *   al-Rāzī and Abū al-Suʿūd   the opening line of the surah, saying where it came
 *                              down, as one more witness under "where it came down".
 *                              A line naming an ayah in figures is the printer's
 *                              heading and not the author's, and a line carrying a
 *                              report is left out, by the rule that nothing weak
 *                              goes in an introduction.
 *   Ibn ʿĀshūr                 his statement of the surah's aims, «أغراض هذه السورة»,
 *                              whole. Tafsir.app's copy does not hold his prefaces,
 *                              so these are read from OpenITI's Shamela typing, by
 *                              volume and page, each with its page on Shamela. Its
 *                              page number there is the mark's place among all the
 *                              marks, unnumbered pages counted. Volume 8's first
 *                              part is unnumbered in the typing, so al-Aʿrāf's aims
 *                              have a page there and no printed volume and page.
 *
 *   node scripts/build-voices.mjs         (npm run gen:voices)
 *
 * Writes into src/content/intros/<n>.json, and then `npm run lock:intros` holds the
 * first two to the site's copies like any other quotation.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";

const CACHE = new URL("../node_modules/.cache/mishkat/", import.meta.url);
const INTROS = new URL("../src/content/intros/", import.meta.url);
const TAFSIR = new URL("../public/tafsir/", import.meta.url);
const ASHUR =
  "https://raw.githubusercontent.com/OpenITI/1400AH/6b4084ba42c8e0bd7c888a8c4b37c43ca771c322/data/1393MuhammadTahirIbnCashurTunisi/1393MuhammadTahirIbnCashurTunisi.TahrirWaTanwir/1393MuhammadTahirIbnCashurTunisi.TahrirWaTanwir.Shamela0009776-ara1";

const VOWELS = /[ً-ْٰـ]/g;
/** A report, which the introductions leave to the sections that grade them. */
const REPORT = /روي|رواه|روى|أخرج|حديث|قال رسول|قال النبي|عن ابن عباس|قال ابن عباس/u;
const PLACE = /مكية|مدنية/u;
const AYAH_HEAD = /^(?:# )?### \| \[سورة .{2,30}\((\d+)\) *:/u;
/** His heading over a surah's aims. */
const AIMS_HEAD = /^(?:# )?### \| (?:من )?(?:ال)?(?:أغراض|مقاصد|محتويات)/u;
/**
 * Where a surah's aims do not simply run from his heading to the first ayah: the
 * words that open them, or null for the heading, and the words that come after
 * them, read surah by surah. Al-Fātiḥah's he sends the reader back for, «وأغراضها قد
 * علمت من بيان وجه تسميتها أم القرآن», and they are the second reason given there.
 * Those of Yūsuf, Luqmān, Ṣād and al-Kāfirūn open after an occasion, which stays out.
 */
const BOUNDS = {
  1: ["الثاني: أنها تشتمل محتوياتها", "الثالث: أنها تشتمل معانيها"],
  3: ["واشتملت هذه السورة، من الأغراض", "وقد عملت أن سبب نزول"],
  4: ["وقد اشتملت على أغراض وأحكام"],
  5: ["وقد احتوت على تمييز الحلال"],
  9: ["فافتتحت السورة بتحديد مدة العهود", "اعلم أنه قد ترك"],
  11: ["وأغراضها: ابتدأت"],
  12: ["فأهم أغراضها"],
  14: ["واشتملت من الأغراض"],
  22: ["ومن أغراض هذه السورة:"],
  27: [null, "قال ابن الفرس:"],
  31: ["وابتدئ ذكر لقمان"],
  35: ["أغراض هذه السورة اشتملت"],
  36: [null, "فكانت هذه السورة جديرة بأن تسمى"],
  38: ["توبيخ المشركين على تكذيبهم الرسول"],
  49: [null, "وهذه السورة هي أول سور المفصل"],
  101: [null, "[1- 3]"],
  109: ["وبهذا يعلم الغرض"],
};
/**
 * Words in the aims that begin something to leave out, up to the end of the
 * paragraph: reports, by the rule that nothing weak goes in an introduction, and
 * al-Zamakhsharī, by the rule that the introductions quote Ahl al-Sunnah.
 */
const LEFT_OUT = {
  6: ["قال فخر الدين: قال الأصوليون", "وفي «صحيح البخاري» أن ابن عباس", "ووردت في فضل سورة الأنعام"],
  12: ["فقد كان النضر بن الحارث", "وكان النضر يتردد"],
  17: ["وعن ابن عباس أنه قال: التوراة", "وفي رواية عنه: ثمان عشرة", "ويعني بالتوراة الألواح", "على أن كلام ابن عباس"],
  26: ["قال في «الكشاف» : كل قصة", "وفيها من الاعتبار ما في غيرها"],
  32: ["ومن مزايا هذه السورة وفضائلها"],
  34: ["وعن مقاتل: أن سبب نزولها"],
  40: ["وورد في فضل هذه السورة"],
  55: ["قال في «الكشاف» : «أراد الله"],
  75: ["وفي «تفسير ابن عطية»"],
  103: ["وقد كان أصحاب رسول الله", "وعن الشافعي: لو تدبر"],
  112: ["والأحاديث في فضائلها"],
};

async function ashurText() {
  const file = new URL("voices-ashur-6b4084ba.txt", CACHE);
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    const res = await fetch(ASHUR);
    if (!res.ok) throw new Error(`${res.status} for Ibn ʿĀshūr`);
    text = await res.text();
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, text, "utf8");
  }
  return text.replace(/\r\n/g, "\n").replace(/\n~~/g, " ");
}

async function firstPassage(id, surah) {
  const { surahs } = JSON.parse(await readFile(new URL(`${id}/index.json`, TAFSIR), "utf8"));
  const part = JSON.parse(await readFile(new URL(`${id}/${surah}-${surahs[surah][0]}.json`, TAFSIR), "utf8"));
  return part.passages[0][2].replace(/\(p-[\d٠-٩]+\)/g, "");
}

/** The line that opens a surah and says where it came down, if the author says it plainly. */
function openingLine(text) {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
    .find((l) => PLACE.test(l.replace(VOWELS, "")));
  if (!line) return null;
  const plain = line.replace(VOWELS, "");
  if (REPORT.test(plain) || /\d|[٠-٩]/u.test(plain.replace(/\(\d+\)/g, ""))) return null;
  return line;
}

function saysOf(line) {
  const plain = line.replace(VOWELS, "");
  const makkan = plain.search(/مكية/u);
  const madinan = plain.search(/مدنية/u);
  const [first, other] = madinan < 0 || (makkan >= 0 && makkan < madinan) ? ["Makkan", "Madinan"] : ["Madinan", "Makkan"];
  if (makkan >= 0 && madinan >= 0 && /قيل|أو /u.test(plain)) return `${first}; ${other} is also said.`;
  if (/قيل:? *إلا/u.test(plain)) return `${first}; some except what he names.`;
  if (/إلا/u.test(plain)) return `${first}, with the exception he names.`;
  if (/مختلف/u.test(plain)) return `${first}, with a difference over it.`;
  return `${first}.`;
}

/** A stretch of the typing as paragraphs, its marks gone and its broken lines mended. */
function paragraphsOf(stretch) {
  const out = [];
  let open = false;
  for (const raw of stretch.split("\n")) {
    const inline = /^### \| /u.test(raw);
    const line = raw
      .replace(/^(?:# )?(?:### \|+ ?)?/u, "")
      .replace(/\s*ms\d+\s*/g, " ")
      .replace(/\s*PageV\d+P\d+\s*/g, " ")
      .replace(/\s*\(\d{1,2}\)(?=\s|$)/g, "")
      .replace(/\[\d+(?:\s*[-،]\s*\d+)?\]$/u, "")
      .trim();
    if (!line || /^[-–.]$/.test(line)) continue;
    if (open || inline) out[out.length - 1] = `${out.at(-1) ?? ""} ${line}`.trim();
    else out.push(line);
    open = inline || !/[.:؟!»]$/u.test(line);
  }
  return out;
}

/** Each surah's statement of its aims, and where it stands in the printed book. */
function aimsOf(text) {
  const lines = text.split("\n");
  const starts = [];
  let at = 0;
  for (const l of lines) {
    starts.push(at);
    at += l.length + 1;
  }
  const first = new Map();
  const last = new Map();
  lines.forEach((l, i) => {
    const m = AYAH_HEAD.exec(l);
    if (!m) return;
    if (!first.has(+m[1])) first.set(+m[1], i);
    last.set(+m[1], i);
  });
  const marks = [...text.matchAll(/PageV(\d+)P(\d+)/g)].map((m, id) => ({ at: m.index, vol: +m[1], page: +m[2], id }));

  const out = new Map();
  for (let s = 1; s <= 114; s++) {
    const end = starts[first.get(s)];
    const from = s === 1 ? end - 40000 : starts[last.get(s - 1)];
    const window = text.slice(from, end);
    const [opens, closes] = BOUNDS[s] ?? [];
    let open;
    if (opens) open = window.lastIndexOf(opens);
    else {
      const heads = [];
      let k = 0;
      for (const l of window.split("\n")) {
        if (AIMS_HEAD.test(l)) heads.push(k + l.length);
        k += l.length + 1;
      }
      open = heads.at(-1) ?? -1;
    }
    const close = closes ? window.indexOf(closes, open) : window.length;
    if (open < 0 || close < 0) throw new Error(`surah ${s}: its aims are not where they were`);
    const paragraphs = paragraphsOf(window.slice(open, close).replace(/\s+$/u, "")).map((p) => {
      const at = Math.min(...(LEFT_OUT[s] ?? []).map((w) => p.indexOf(w)).filter((k) => k >= 0), p.length);
      return p.slice(0, at).trim().replace(/[،,]$/u, ".");
    });
    // A mark closes its page, so what is quoted is on the first mark after it.
    const mark = marks.find((m) => m.at > from + open);
    out.set(s, { quote: paragraphs.filter(Boolean).join("\n"), vol: mark.vol, page: mark.page, shamela: mark.id });
  }
  return out;
}

const aims = aimsOf(await ashurText());
let razi = 0;
let suud = 0;
for (let s = 1; s <= 114; s++) {
  const file = new URL(`${s}.json`, INTROS);
  const intro = JSON.parse(await readFile(file, "utf8"));
  const attested = (intro.revelation.attested ?? []).filter((e) => e.work !== "alrazi" && e.work !== "abu-alsuod");
  const rLine = openingLine(await firstPassage("alrazi", s));
  const sLine = openingLine(await firstPassage("abu-alsuod", s));
  if (rLine) {
    attested.push({ work: "alrazi", ayah: 1, quote: rLine, says: saysOf(rLine) });
    razi++;
  }
  if (sLine) {
    attested.push({ work: "abu-alsuod", ayah: 1, quote: sLine, says: saysOf(sLine) });
    suud++;
  }
  intro.revelation.attested = attested;
  intro.voices = { ashur: aims.get(s) };
  await writeFile(file, `${JSON.stringify(intro, null, 2)}\n`, "utf8");
}
console.log(`al-Rāzī on ${razi} surahs, Abū al-Suʿūd on ${suud}, Ibn ʿĀshūr's aims on ${aims.size}`);
