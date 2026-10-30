/**
 * How well the ayah study reads its books, measured over the whole Qurʾān.
 *
 * `src/lib/ulum/read.ts` cuts each book of grammar, readings and reports into
 * remarks and sets each remark on the words it quotes. A remark that cannot
 * be placed is still shown, in the book's order, but it points at nothing —
 * so how many find their words is the measure of how well the page serves a
 * book. This runs every reader over every passage on the shelf and says.
 *
 *   node scripts/check-ulum.mjs              every ayah
 *   node scripts/check-ulum.mjs 2:255 1:4    just these, with what was read
 *
 * A placement is "exact" when the skeleton of the words it lands on is the
 * skeleton of what the book quoted — the strictest test there is, and one a
 * remark on a prefix («(الواو) عاطفة») cannot pass and is not expected to.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { AYAT } from "./corpus-cache.mjs";

const ROOT = new URL("../", import.meta.url);
const LIB = new URL("src/lib/ulum/", ROOT);
// Not under node_modules, where Node will not strip types.
const TMP = new URL("mishkat-ulum-check/", pathToFileURL(`${tmpdir()}/`));

// Node runs TypeScript with its types stripped, but wants the extension on an
// import, which the site's own code leaves off. A copy with them put on.
await mkdir(TMP, { recursive: true });
for (const name of await readdir(LIB)) {
  if (!name.endsWith(".ts")) continue;
  const src = (await readFile(new URL(name, LIB), "utf8")).replace(/from "\.\/([\w-]+)"/g, 'from "./$1.ts"');
  await writeFile(new URL(name, TMP), src);
}
const read = await import(new URL("read.ts", TMP).href);
const { readViews, readTabariViews } = await import(new URL("views.ts", TMP).href);
const { weakOf } = await import(new URL("grades.ts", TMP).href);
const { skeleton, quoteSkeleton } = await import(new URL("skeleton.ts", TMP).href);

const morph = new Map();
async function wordsOf(s) {
  if (!morph.has(s)) {
    const j = JSON.parse(await readFile(new URL(`public/corpus/morph/${s}.json`, ROOT), "utf8"));
    morph.set(s, j.ayat.map((ayah) => ayah.map((segs) => segs.map(([form]) => form).join(""))));
  }
  return morph.get(s);
}

/** Every passage of a work, as the mirror stored it: [surah, from, to, text]. */
async function* passages(shelf, id) {
  const dir = new URL(`public/${shelf}/${id}/`, ROOT);
  if (!existsSync(dir)) return;
  const index = JSON.parse(await readFile(new URL("index.json", dir), "utf8"));
  for (let s = 1; s <= 114; s++) {
    for (const first of index.surahs[s] ?? []) {
      const part = JSON.parse(await readFile(new URL(`${s}-${first}.json`, dir), "utf8"));
      for (const [from, to, text] of part.passages) yield [s, from, to, text];
    }
  }
}

const only = process.argv.slice(2).filter((a) => /^\d+:\d+$/.test(a));
const wanted = (s, from, to) =>
  !only.length || only.some((k) => {
    const [ks, ka] = k.split(":").map(Number);
    return ks === s && from <= ka && ka <= to;
  });

async function range(s, from, to) {
  const ayat = await wordsOf(s);
  const words = [];
  for (let a = from; a <= to; a++) words.push(...ayat[a - 1]);
  return words;
}

function score(remarks, words) {
  let placed = 0;
  let exact = 0;
  for (const r of remarks) {
    if (!r.at) continue;
    placed++;
    if (words.slice(r.at.from, r.at.to + 1).map(skeleton).join("") === quoteSkeleton(r.quote)) exact++;
  }
  return { n: remarks.length, placed, exact };
}

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const tally = {};
const add = (name, s) => {
  const t = (tally[name] ??= { n: 0, placed: 0, exact: 0, passages: 0 });
  t.n += s.n;
  t.placed += s.placed;
  t.exact += s.exact;
  t.passages++;
};

// al-Jadwal: the words, and the sentences.
let ayatWithMain = 0;
let ayatSeen = new Set();
for await (const [s, from, to, text] of passages("ulum", "aljadwal")) {
  if (!wanted(s, from, to)) continue;
  const words = await range(s, from, to);
  const j = read.readJadwal(text, words);
  add("al-Jadwal · iʿrāb", score(j.iraab, words));
  add("al-Jadwal · jumal", score(j.jumal, words));
  add("al-Jadwal · ṣarf", score(j.sarf, words));
  // Which of the passage's ayat have a sentence of their own beginning in them.
  const ayat = await wordsOf(s);
  let at = 0;
  for (let a = from; a <= to; a++) {
    const n = ayat[a - 1].length;
    if (j.jumal.some((x) => x.main && x.at && x.at.from >= at && x.at.from < at + n)) ayatWithMain++;
    ayatSeen.add(`${s}:${a}`);
    at += n;
  }
  if (only.length) {
    console.log(`\n── al-Jadwal ${s}:${from}-${to}`);
    for (const r of j.iraab) console.log(`  ${r.at ? `${r.at.from + 1}-${r.at.to + 1}`.padEnd(6) : "  ?   "} (${r.quote}) ${r.text.slice(0, 70)}`);
    for (const x of j.jumal) console.log(`  ${x.main ? "MAIN" : "    "} ${x.at ? `${x.at.from + 1}-${x.at.to + 1}` : "?"} «${x.quote}» ${x.place}`);
    for (const r of j.sarf) console.log(`  ṣarf ${r.at ? r.at.from + 1 : "?"} (${r.quote}) wazn=${read.waznOf(r.text)}`);
  }
}

for (const [id, name, byLine] of [
  ["iraab-daas", "al-Daʿʿās", false],
  ["aliraab-almuyassar", "al-Iʿrāb al-muyassar", true],
]) {
  for await (const [s, from, to, text] of passages("ulum", id)) {
    if (!wanted(s, from, to)) continue;
    const words = await range(s, from, to);
    const rs = read.ornate(text, words, byLine);
    add(name, score(rs, words));
    if (only.length) {
      console.log(`\n── ${name} ${s}:${from}-${to}`);
      for (const r of rs) console.log(`  ${r.at ? `${r.at.from + 1}-${r.at.to + 1}`.padEnd(6) : "  ?   "} ﴿${r.quote}﴾ ${r.text.slice(0, 60)}`);
    }
  }
}

for await (const [s, from, to, text] of passages("ulum", "iraab-aldarweesh")) {
  if (!wanted(s, from, to)) continue;
  const words = await range(s, from, to);
  const d = read.readDarwish(text, words);
  add("Darwīsh · lughah", score(d.lughah, words));
  add("Darwīsh · iʿrāb", score(d.iraab, words));
  const dev = { n: d.balagha.length, placed: d.balagha.filter((x) => x.at.length).length, exact: 0 };
  add("Darwīsh · figures quoting the ayah", dev);
  if (only.length) {
    console.log(`\n── Darwīsh ${s}:${from}-${to}`);
    for (const x of d.balagha) console.log(`  [${x.at.map((p) => `${p.from + 1}-${p.to + 1}`).join(",")}] ${x.name} :: ${x.text.slice(0, 60)}`);
  }
}

for await (const [s, from, to, text] of passages("ulum", "aldur-almasoon")) {
  if (!wanted(s, from, to)) continue;
  const words = await range(s, from, to);
  const rs = read.byPhrase(text, words).filter((r) => r.quote);
  add("al-Samīn", score(rs, words));
}

for await (const [s, from, to, text] of passages("ulum", "qiraat-almawsoah")) {
  if (!wanted(s, from, to)) continue;
  const words = await range(s, from, to);
  const vs = read.readMawsuah(text, words);
  add("al-Abyārī · readings", score(vs, words));
  if (only.length) {
    console.log(`\n── al-Abyārī ${s}:${from}-${to}`);
    for (const v of vs) console.log(`  ${v.at ? v.at.from + 1 : "?"} ${v.quote} ${v.shadh ? "(shādhdh)" : ""} → ${v.readings.length} readings`);
  }
}

const tiers = { sahabah: 0, tabiun: 0, atba: 0, marfu: 0, unknown: 0, out: 0 };
let reports = 0;
let phrased = 0;
for await (const [s, from, to, text] of passages("tafsir", "ibn-abi-hatim")) {
  if (!wanted(s, from, to)) continue;
  const words = await range(s, from, to);
  const rs = read.readReports(text, words);
  reports += rs.length;
  phrased += rs.filter((r) => r.at).length;
  for (const r of rs) tiers[r.tier]++;
  if (only.length) {
    console.log(`\n── Ibn Abī Ḥātim ${s}:${from}-${to}`);
    for (const r of rs) console.log(`  [${r.n}] ${r.at ? `${r.at.from + 1}-${r.at.to + 1}` : "?"} ${r.tier.padEnd(7)} ${r.who.padEnd(14)} ${r.text.slice(0, 50)}`);
  }
}

// Past where Ibn Abī Ḥātim's copy stops: which book each ayah's reports come from.
const OF_A_GENERATION = new Set(["sahabah", "tabiun", "atba"]);
const speaking = { hatim: new Set(), tabari: new Set(), durr: new Set() };
const otherTiers = {
  tabari: { sahabah: 0, tabiun: 0, atba: 0, marfu: 0, unknown: 0, out: 0 },
  durr: { sahabah: 0, tabiun: 0, atba: 0, marfu: 0, unknown: 0, out: 0 },
};
async function reach(id, reader, name) {
  for await (const [s, from, to, text] of passages("tafsir", id)) {
    if (!wanted(s, from, to)) continue;
    const words = await range(s, from, to);
    const counts = [];
    for (let a = from; a <= to; a++) counts.push((await range(s, a, a)).length);
    for (const r of reader(text, words)) {
      if (otherTiers[name]) otherTiers[name][r.tier]++;
      if (!r.at || !OF_A_GENERATION.has(r.tier)) continue;
      let start = 0;
      counts.forEach((c, i) => {
        if (r.at.to >= start && r.at.from < start + c) speaking[name].add(`${s}:${from + i}`);
        start += c;
      });
    }
  }
}
await reach("ibn-abi-hatim", read.readReports, "hatim");
await reach("tabari", read.readTabari, "tabari");
await reach("aldur-almanthoor", read.readDurr, "durr");

// Where the books say the scholars differ, and how many of their lists read whole.
const VOWELS = /[\u064B-\u0652\u0670\u0640]/g;
const STATED = /(قولان|قولين|وجهان|وجهين|تأويلان|تأويلين|(?:ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة)\s+(?:أقوال|أوجه|تأويلات|أقاويل))/g;
const differing = new Set();
const lists = {};
for (const [shelf, id, reader] of [
  ["tafsir", "tabari", readTabariViews],
  ["tafsir", "zad-almaseer", readViews],
  ["tafsir", "samaani", readViews],
  ["tafsir", "qurtubi", readViews],
  ["tafsir", "adwaa-albayan", readViews],
  ["ulum", "aldur-almasoon", readViews],
]) {
  const t = (lists[id] = { said: 0, read: 0, placed: 0, named: 0, views: 0 });
  for await (const [s, from, to, text] of passages(shelf, id)) {
    if (!wanted(s, from, to)) continue;
    t.said += (text.replace(VOWELS, "").match(STATED) ?? []).length;
    const words = await range(s, from, to);
    const counts = [];
    for (let a = from; a <= to; a++) counts.push((await range(s, a, a)).length);
    for (const d of reader(text, words)) {
      t.read++;
      t.views += d.views.length;
      t.named += d.views.filter((v) => v.holders.length).length;
      if (!d.at) continue;
      t.placed++;
      let start = 0;
      counts.forEach((c, i) => {
        if (d.at.to >= start && d.at.from < start + c) differing.add(`${s}:${from + i}`);
        start += c;
      });
    }
  }
}
const marked = {};
for (const [id, reader] of [["ibn-abi-hatim", read.readReports], ["tabari", read.readTabari], ["aldur-almanthoor", read.readDurr]]) {
  const t = (marked[id] = {});
  for await (const [s, from, to, text] of passages("tafsir", id)) {
    if (!wanted(s, from, to)) continue;
    for (const r of reader(text, [])) {
      if (r.tier === "marfu") continue;
      const weak = weakOf(r.text);
      if (weak) t[weak.by] = (t[weak.by] ?? 0) + 1;
    }
  }
}

let fawaid = 0;
for await (const [s, from, to, text] of passages("tafsir", "ibn-uthaymeen")) {
  if (!wanted(s, from, to)) continue;
  fawaid += read.benefits(text).length;
}
let guidance = 0;
for await (const [s, from, to, text] of passages("tafsir", "aysar-altafasir")) {
  if (!wanted(s, from, to)) continue;
  guidance += read.readAysar(text).guidance.length;
}

console.log("\nPlaced on their words:");
for (const [name, t] of Object.entries(tally)) {
  console.log(
    `  ${name.padEnd(36)} ${String(t.n).padStart(7)} remarks in ${String(t.passages).padStart(5)} passages · placed ${pct(t.placed, t.n).padStart(6)} · exact ${pct(t.exact, t.placed).padStart(6)}`,
  );
}
if (!only.length) {
  const total = AYAT.reduce((a, b) => a + b, 0);
  console.log(`\n  al-Jadwal: ${ayatWithMain} of ${ayatSeen.size} ayat (of ${total}) have a sentence of their own beginning in them.`);
}
console.log(`  Ibn Abī Ḥātim: ${reports} reports, ${pct(phrased, reports)} under a phrase placed; by tier ${JSON.stringify(tiers)}`);
console.log(`  al-Ṭabarī: ${JSON.stringify(otherTiers.tabari)}. al-Durr: ${JSON.stringify(otherTiers.durr)}`);
const byTabari = [...speaking.tabari].filter((k) => !speaking.hatim.has(k));
const byDurr = [...speaking.durr].filter((k) => !speaking.hatim.has(k) && !speaking.tabari.has(k));
console.log(`  A report of these generations on an ayah: ${speaking.hatim.size} from Ibn Abī Ḥātim, ${byTabari.length} more from al-Ṭabarī, ${byDurr.length} more from al-Durr.`);
for (const [id, t] of Object.entries(lists)) {
  console.log(`  ${id}: said ${t.said} lists, ${t.read} read whole (${pct(t.read, t.said)}), ${t.placed} placed; ${t.views} views, ${pct(t.named, t.views)} naming who held them.`);
}
console.log(`  Ayat with a recorded difference: ${differing.size}.`);
console.log(`  Reports marked weak, by who says so: ${JSON.stringify(marked)}`);
console.log(`  Ibn ʿUthaymīn: ${fawaid} benefits. Aysar: ${guidance} points of guidance.`);
