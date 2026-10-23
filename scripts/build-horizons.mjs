/**
 * The score of every surah's film: which word of it is which sign.
 *
 * Horizons recites a surah over the signs it names — the sun at وَٱلشَّمْسِ,
 * the sea at ٱلْبَحْرِ — and the world it shows has to know, before a note is
 * played, where in the recitation each of them falls. This works that out for
 * all 6,236 ayat from the Quranic Arabic Corpus's morphology: every segment of
 * every word with its root and its lemma, so the sun is found as the lemma
 * شَمْس and not as a string of letters that might be some other word.
 *
 * Three things are found:
 *
 *   signs   a lemma in LEXICON is a sign at its word; RULES find the ones that
 *           take two words — rain is مَآء sent down مِنَ ٱلسَّمَآءِ, a whole day
 *           is the night and the day in one ayah, the earth spread is أَرْض
 *           with مَدَّ or بَسَطَ or سُطِحَتْ beside it;
 *   veil    a lemma in UNSEEN — the Garden, the Fire, the Day, the angels, the
 *           Throne — veils the world from its word to the end of the ayah,
 *           since nothing of the unseen is drawn;
 *   look    "Have you not seen…?", "Look…": the camera stops and looks.
 *
 * Then `src/content/horizons/direction.txt`, written by hand, sets right what
 * a list of words gets wrong — passages of the Hour with no word for it,
 * gardens of this world, similes. And the ayat of prostration are given a bow.
 *
 * Writes `public/horizons/<surah>.json`. Structure only — positions and sign
 * names, never the text: the Foundation's terms do not allow its content to be
 * bundled with the site, and nothing here is its content.
 *
 *   node scripts/build-horizons.mjs          (npm run gen:horizons)
 *   node scripts/build-horizons.mjs --stats  say what was found, surah by surah
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";

const COMMIT = "8f38b39016824284f9ed16ae15069ff9102c4acf";
const MORPHOLOGY = `https://raw.githubusercontent.com/mustafa0x/quran-morphology/${COMMIT}/quran-morphology.txt`;
const CACHE = new URL("../node_modules/.cache/mishkat/", import.meta.url);
const ROOT = new URL("../", import.meta.url);
const OUT = new URL("../public/horizons/", import.meta.url);

const stats = process.argv.includes("--stats");
const problems = [];

async function morphology() {
  const file = new URL(`quran-morphology-${COMMIT.slice(0, 8)}.txt`, CACHE);
  try {
    return await readFile(file, "utf8");
  } catch {
    const res = await fetch(MORPHOLOGY);
    if (!res.ok) throw new Error(`${res.status} for the morphology`);
    const text = await res.text();
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, text, "utf8");
    return text;
  }
}

// ── what the site already knows ─────────────────────────────────────────────

/** The sign names, as signs.ts defines them: a line, a name and a brace. */
const signsTs = await readFile(new URL("src/lib/horizons/signs.ts", ROOT), "utf8");
const SIGN_IDS = new Set(
  [...signsTs.split("export const SIGNS")[1].split("satisfies")[0].matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]),
);

/** Each surah's place and its ayat of prostration, from the generated facts. */
const factsTs = await readFile(new URL("src/lib/quran/surahFacts.ts", ROOT), "utf8");
const FACTS = [...factsTs.matchAll(/\{ revealed: \d+, place: "(\w+)", ayat: (\d+),.*?sajdah: \[([\d, ]*)\]/g)].map((m) => ({
  place: m[1],
  ayat: Number(m[2]),
  sajdah: m[3].split(",").map((s) => Number(s.trim())).filter(Boolean),
}));
if (FACTS.length !== 114) throw new Error(`surahFacts.ts: ${FACTS.length} surahs read, 114 expected`);

/** The passages of each surah, from its introduction's outline. */
async function passagesOf(surah) {
  try {
    const intro = JSON.parse(await readFile(new URL(`src/content/intros/${surah}.json`, ROOT), "utf8"));
    const outline = (intro.outline ?? []).filter((o) => o.from && o.to);
    if (outline.length) return outline.map((o) => ({ from: o.from, to: o.to, title: o.title ?? "" }));
  } catch {
    /* no introduction yet */
  }
  return [{ from: 1, to: FACTS[surah - 1].ayat, title: "" }];
}

// ── the corpus, word by word ────────────────────────────────────────────────

/**
 * Arabic marks in canonical order. A shadda typed before its vowel and one
 * typed after it are the same letter to a reader and two strings to a
 * comparison; the corpus and this file need not agree on which they typed.
 */
const N = (s) => s.normalize("NFC");

/** ayat.get("91:1") → [{ segs: [{ root, lemma, tags }] }, …], counted from 1. */
const ayat = new Map();
for (const line of (await morphology()).trim().split("\n")) {
  const [loc, , pos, tags] = line.split("\t");
  const [s, a, w] = loc.split(":").map(Number);
  const key = `${s}:${a}`;
  let words = ayat.get(key);
  if (!words) ayat.set(key, (words = []));
  const word = (words[w - 1] ??= { segs: [] });
  word.segs.push({
    root: N(/ROOT:([^|]+)/.exec(tags)?.[1] ?? ""),
    lemma: N(/LEM:([^|]+)/.exec(tags)?.[1] ?? ""),
    pos,
    tags,
  });
}

const strip = (s) =>
  s
    .normalize("NFC")
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/[أإآٱ]/g, "ا");

const lemmasOf = (word) => word.segs.map((g) => g.lemma).filter(Boolean);
const hasLemma = (word, set) => word.segs.some((g) => set.has(g.lemma));
const hasRoot = (word, root) => word.segs.some((g) => g.root === root);

/** A set of lemmas, as the corpus spells them. */
const L = (...xs) => new Set(xs.map(N));

// ── the lexicon ─────────────────────────────────────────────────────────────
//
// Lemmas, spelled as the corpus spells them. A lemma that never turns up is a
// misspelling here, and the run says so rather than quietly finding nothing.

const LEXICON_AS_TYPED = {
  // the sky and its lights
  "شَمْس": "sun",
  "قَمَر": "moon",
  "أَهِلَّة": "crescent",
  "عُرْجُون": "crescent",
  "نَجْم": "stars",
  "كَوْكَب": "stars",
  "مِصْباح": "lamps",
  "بُرُوج": "stars",
  "شِهاب": "meteor",
  "شُهُب": "meteor",
  "ثاقِب": "meteor",
  "خُنَّس": "planets",
  "كُنَّس": "planets",
  "شِعْرَى": "sirius",
  "فَلَك": "orbit",
  "يَسْبَحُ": "orbit",
  "سِراج": "lampSun",
  "ضِياء": "sunlight",
  "نُور": "light",
  "سَماء": "sky",
  "أُفُق": "horizons",
  "مَشْرِق": "horizons",
  "مَغْرِب": "horizons",
  "عالَم": "worlds",
  // the hours
  "لَيْل": "night",
  "لَيْلَة": "night",
  "غَسَق": "night",
  "غاسِق": "night",
  "سَجَى": "night",
  "أَغْطَشَ": "night",
  "عِشاء": "night",
  "عَسْعَسَ": "nightDeparts",
  "نَهار": "day",
  "جَلَّى": "day",
  "تَجَلَّى": "day",
  "فَجْر": "dawn",
  "صُبْح": "dawn",
  "إِصْباح": "dawn",
  "فَلَق": "dawn",
  "تَنَفَّسَ": "dawn",
  "أَسْفَرَ": "dawn",
  "مَطْلَع": "dawn",
  "طُلُوع": "dawn",
  "إِشْراق": "dawn",
  "مُشْرِق": "dawn",
  "سَحَر": "predawn",
  "ضُحًى": "forenoon",
  "بُكْرَة": "morning",
  "إِبْكار": "morning",
  "غُدُوّ": "morning",
  "غَداة": "morning",
  "مُصْبِح": "morning",
  "صَباح": "morning",
  "عَشِيّ": "evening",
  "عَشِيَّة": "evening",
  "أَصِيل": "evening",
  "رَواح": "evening",
  "غُرُوب": "sunset",
  "دُلُوك": "sunset",
  "غَرَبَت": "sunset",
  "شَفَق": "twilight",
  "ظَهِيرَة": "noon",
  "ظِلّ": "shade",
  "ظُلُمَة": "darkness",
  "مُظْلِم": "darkness",
  "أَظْلَمَ": "darkness",
  // weather
  "سَحاب": "cloud",
  "غَمام": "cloud",
  "مُزْن": "cloud",
  "كِسَف": "cloud",
  "ظُلَّة": "cloud",
  "عارِض": "cloud",
  "غَيْث": "rain",
  "يُغاثُ": "rain",
  "وَدْق": "rain",
  "وابِل": "rain",
  "مِدْرار": "rain",
  "صَيِّب": "storm",
  "طَلّ": "drizzle",
  "بَرْق": "lightning",
  "رَعْد": "thunder",
  "بَرَد": "hail",
  "رِيح": "wind",
  "عاصِف": "gale",
  "عاصِفَة": "gale",
  "صَرْصَر": "gale",
  "إِعْصار": "gale",
  "سَراب": "mirage",
  // water
  "بَحْر": "sea",
  "يَمّ": "sea",
  "فُلْك": "sea",
  "سَفِينَة": "sea",
  "جارِيَة": "sea",
  "جَوار": "sea",
  "أَعْلام": "sea",
  "مَوْج": "waves",
  "لُؤْلُؤ": "pearls",
  "مَرْجان": "pearls",
  "نَهَر": "river",
  "سَرِيّ": "river",
  "يَنبُوع": "spring",
  "مَعِين": "spring",
  "فُجِّرَتْ": "spring",
  "انفَجَرَتْ": "spring",
  "يَتَفَجَّرُ": "spring",
  "تَفْجِير": "spring",
  "سَيْل": "torrent",
  "سالَتْ": "torrent",
  "زَبَد": "torrent",
  "أَوْدِيَة": "valley",
  "واد": "valley",
  // land
  "جَبَل": "mountains",
  "رَواسِي": "mountains",
  "أَوْتاد": "mountains",
  "طُور": "mountains",
  "أَرْسَى": "mountains",
  "صَخْرَة": "rock",
  "صَخْر": "rock",
  "حَجَر": "rock",
  "صَفْوان": "rock",
  "أَحْقاف": "dunes",
  "كَثِيب": "dunes",
  "رَبْوَة": "hill",
  "صِراط": "straight",
  // what grows
  "نَبات": "plants",
  "أَنۢبَتَ": "plants",
  "تَنۢبُتُ": "plants",
  "رَيْحان": "plants",
  "يَقْطِين": "plants",
  "زَرْع": "crops",
  "تَزْرَعُ": "crops",
  "زارِع": "crops",
  "زُرّاع": "crops",
  "حَرْث": "crops",
  "تَحْرُثُ": "crops",
  "حَبّ": "grain",
  "حَبَّة": "grain",
  "سُنبُلَة": "grain",
  "سُنبُل": "grain",
  "عَصْف": "grain",
  "حَصِيد": "harvest",
  "حَصاد": "harvest",
  "خَضِر": "green",
  "مُخْضَرَّة": "green",
  "أَخْضَر": "green",
  "خُضْر": "green",
  "مَرْعَى": "pasture",
  "أَبّ": "pasture",
  "قَضْب": "pasture",
  "غُثاء": "dry",
  "هَشِيم": "dry",
  "حُطام": "dry",
  "مُصْفَرّ": "dry",
  "شَجَر": "trees",
  "شَجَرَة": "trees",
  "أَثْل": "trees",
  "سِدْر": "trees",
  "تِين": "trees",
  "وَرَقَة": "trees",
  "نَخْل": "palms",
  "نَخِيل": "palms",
  "نَخْلَة": "palms",
  "طَلْع": "palms",
  "زَيْتُون": "olives",
  "زَيْتُونَة": "olives",
  "زَيْت": "olives",
  "دُهْن": "olives",
  "عِنَب": "vines",
  "مَعْرُوشَة": "vines",
  "رُمّان": "fruit",
  "ثَمَرَة": "fruit",
  "ثَمَر": "fruit",
  "أَثْمَرَ": "fruit",
  "فاكِهَة": "fruit",
  "فَواكِه": "fruit",
  "أَكْمام": "fruit",
  "حَدائِق": "garden",
};
const LEXICON = Object.fromEntries(Object.entries(LEXICON_AS_TYPED).map(([k, v]) => [N(k), v]));

/**
 * The unseen. From the word that names one of these to the end of its ayah,
 * the world is veiled. Two of them — the Garden and the Fire — are also
 * things of this world, a man's orchard, a fire kindled in the cold; where
 * the direction says an ayah is of this world, they are signs instead.
 */
const UNSEEN = L(
  "جَنَّة", "نار", "جَهَنَّم", "جَحِيم", "سَعِير", "سَقَر", "لَظَى", "حُطَمَة", "هاوِيَة", "فِرْدَوْس",
  "عَدْن", "زَقُّوم", "غِسْلِين", "ضَرِيع", "سَلْسَبِيل", "تَسْنِيم", "حُور", "سُندُس", "إِسْتَبْرَق",
  "أَرائِك", "خُلْد", "قِيامَة", "ساعَة", "صُور", "عَرْش", "كُرْسِيّ", "مَلَك", "جِنّ", "جانّ",
  "إِبْلِيس", "شَيْطان", "رُوح",
);
/** What a seen ayah's garden and fire are, as signs. */
const SEEN_AS = { [N("جَنَّة")]: "garden", [N("نار")]: "fire" };
/** "The Day of …" — يَوْم followed closely by one of these is the Day. */
const DAY_OF = L(
  "دِين", "قِيامَة", "فَصْل", "حَسْرَة", "تَغابُن", "جَمْع", "خُلُود", "حِساب", "آزِفَة", "تَلاق", "تَناد",
  "وَعِيد", "آخِر",
);

const NIGHT = L("لَيْل", "لَيْلَة");
const DAY = L("نَهار");
const NIGHT_INTO_DAY = L("يُولِجُ", "كُوِّرَتْ", "خِلْفَة");
const ALTERNATION = L("اخْتِلاف");
const MORNING = L("بُكْرَة", "إِبْكار", "غُدُوّ", "غَداة", "إِشْراق");
const EVENING = L("عَشِيّ", "عَشِيَّة", "أَصِيل", "رَواح");
const SKY = L("سَماء");
const EARTH = L("أَرْض", "بَلْدَة", "بَلَد");
const RAISED = L("رَفَعَ", "بَنَى", "بِناء", "سَمْك", "سَقْف", "عَمَد", "زَيَّنَ", "بُرُوج", "حُبُك", "طَبَق", "مَرْفُوع");
const SPREAD = L("مَدَّ", "بَسَطَ", "بِساط", "فِراش", "فَرَشْ", "مَهْد", "مِهاد", "مَهَّد", "ماهِد", "سُطِحَتْ", "دَحَى", "طَحَى", "قَرار", "ذَلُول");
const REVIVE = L("أَحْيا", "مُحْى", "اهْتَزَّتْ", "رَبَتْ", "هامِدَة", "خاشِع", "مَيْت", "مَيِّت", "مَيْتَة");
const LIFE = L("أَحْيا", "مُحْى", "اهْتَزَّتْ", "رَبَتْ");
const WATER = L("ماء");
const SENT_DOWN = L("أَنزَلَ", "نَزَّلَ");
const SEAS_MEETING = L("مَرَجَ", "بَرْزَخ", "عَذْب", "مِلْح", "أُجاج", "فُرات");
const SEA = L("بَحْر");
const RAIN_SIGNS = new Set(["rain", "storm", "drizzle"]);

/** Signs the hour belongs to, and the hour each comes to — for the rule below. */
const HOUR_OF = Object.fromEntries(
  [...signsTs.matchAll(/^ {2}(\w+): \{ hour: ([\d.]+)/gm)].map((m) => [m[1], Number(m[2])]),
);
/** Slight signs, given way to by any other in the ayah. */
const WEAK = new Set(["sky", "heavens", "worlds", "light"]);

const used = new Set();

/** The signs, the veil and the look the lexicon and the rules find in one ayah. */
function read(key, seen) {
  const words = ayat.get(key) ?? [];
  const cues = [];
  const add = (pos, sign) => cues.push([pos, sign]);
  let veil = 0;
  let look = 0;
  const veilAt = (pos) => {
    if (!veil || pos < veil) veil = pos;
  };

  const all = words.flatMap((w) => lemmasOf(w));
  const any = (set) => all.some((l) => set.has(l));
  const first = (set) => words.findIndex((w) => hasLemma(w, set)) + 1;

  words.forEach((word, i) => {
    const pos = i + 1;
    for (const g of word.segs) {
      if (!g.lemma) continue;
      if (LEXICON[g.lemma]) {
        used.add(g.lemma);
        add(pos, LEXICON[g.lemma]);
      }
      if (UNSEEN.has(g.lemma)) {
        used.add(g.lemma);
        if (seen) {
          // A garden or a fire of this world is a sign. Anything else — the
          // Throne, the Kursī, the angels named beside the thunder — is left
          // entirely alone: nothing is shown for it, nothing marks it, and
          // the creation the ayah speaks of goes on being shown (the owner's
          // ruling, B3: "don't even attempt").
          if (SEEN_AS[g.lemma]) add(pos, SEEN_AS[g.lemma]);
        } else veilAt(pos);
      }
      // The Hereafter: the corpus's lemma for "last", in the feminine.
      if (g.lemma === N("آخِر") && /\bFS\b/.test(g.tags) && !seen) veilAt(pos);
    }
    // "The Day of Judgement", "the Day of Resurrection"…
    if (hasLemma(word, L("يَوْم"))) {
      const after = words.slice(i, i + 3).flatMap(lemmasOf);
      const day = after.some((l) => DAY_OF.has(l) && !(l === N("آخِر") && !after.includes(N("يَوْم"))));
      // …and «يَوْمَئِذٍ», that Day.
      const thatDay = word.segs.some((g) => g.lemma === N("إِذ"));
      if ((day || thatDay) && !seen) veilAt(pos);
    }
    // "Have you not seen…?", "Look…", "Do they not look…?"
    if (hasRoot(word, "رأي") || hasRoot(word, "نظر")) {
      const asked = words.slice(Math.max(0, i - 2), i + 1).some((w) => w.segs.some((g) => /(^|\|)INTG(\||$)/.test(g.tags)));
      const told = word.segs.some((g) => /(^|\|)IMPV(\||$)/.test(g.tags)) || word.segs.some((g) => g.pos === "P" && /IMP/.test(g.tags));
      if ((asked || told) && !look) look = pos;
    }
    // "Travel through the land…"
    if (hasRoot(word, "سير") && word.segs.some((g) => /(^|\|)IMPV(\||$)/.test(g.tags))) add(pos, "journey");
  });

  // Gardens beneath which rivers flow: the formula is the Garden's even where
  // the Garden is not named in the ayah (39:20).
  if (!seen && any(L("جَرَى")) && any(L("تَحْت")) && any(L("نَهَر"))) veilAt(first(L("جَرَى")));

  // ── the signs that take two words ───────────────────────────────────────
  const drop = (pred) => {
    for (let k = cues.length - 1; k >= 0; k--) if (pred(cues[k][1])) cues.splice(k, 1);
  };
  const at = (set) => first(set) || 1;

  // The night and the day together, or the one wrapped over the other: a day.
  if ((any(NIGHT) && any(DAY)) || any(NIGHT_INTO_DAY) || (any(ALTERNATION) && any(NIGHT))) {
    const pos = Math.min(...[NIGHT, DAY, NIGHT_INTO_DAY, ALTERNATION].map(first).filter((p) => p > 0));
    drop((s) => s === "night" || s === "day");
    add(pos, "nightDay");
  }
  // Morning and evening in one breath.
  if (any(MORNING) && any(EVENING)) {
    const pos = Math.min(first(MORNING), first(EVENING));
    drop((s) => s === "morning" || s === "evening" || (s === "dawn" && any(L("إِشْراق"))));
    add(pos, "morningEvening");
  }
  // Rain: water sent down from the sky.
  if (any(WATER) && any(SKY) && any(SENT_DOWN) && !cues.some(([, s]) => RAIN_SIGNS.has(s))) add(at(WATER), "rain");
  // The earth given life after its death.
  if (any(EARTH) && any(LIFE) && any(REVIVE)) add(at(LIFE), "revive");
  // The sky raised, built, adorned.
  if (any(SKY) && any(RAISED)) {
    drop((s) => s === "sky");
    add(at(SKY), "skyRaised");
  } else if (any(SKY) && any(L("أَرْض"))) {
    drop((s) => s === "sky");
    add(at(SKY), "heavens");
  }
  // The earth spread out.
  if (any(EARTH) && any(SPREAD)) add(at(L("أَرْض")) || at(SPREAD), "earthSpread");
  // The shade drawn out.
  if (any(L("ظِلّ")) && any(L("مَدَّ"))) drop((s) => s === "earthSpread");
  // Two seas, a barrier between them.
  const meeting = words.findIndex((w) => hasLemma(w, SEAS_MEETING)) + 1;
  if (meeting && (any(SEA) || any(L("مَرَجَ")))) {
    drop((s) => s === "sea");
    add(meeting, "twoSeas");
  } else if (any(L("فُرات"))) add(at(L("فُرات")), "river");

  // A sign written into a seen ayah stands; one in the veiled part does not.
  let kept = cues.filter(([pos]) => !veil || pos < veil);
  // The slight signs give way to any other.
  if (kept.some(([, s]) => !WEAK.has(s))) kept = kept.filter(([, s]) => !WEAK.has(s));
  return { cues: kept, veil, look, words: words.length };
}

// ── the direction ───────────────────────────────────────────────────────────

const direction = { veil: new Set(), see: new Set(), quiet: new Map(), sign: [] };

/** `81:1-14`, `2:255` — every ayah key it covers. */
function keysOf(range, where) {
  const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(range);
  if (!m) {
    problems.push(`${where}: "${range}" is not a reference`);
    return [];
  }
  const s = Number(m[1]);
  const from = Number(m[2]);
  const to = Number(m[3] ?? m[2]);
  const n = FACTS[s - 1]?.ayat ?? 0;
  if (!n || from < 1 || to > n || to < from) {
    problems.push(`${where}: ${range} is not in surah ${s}`);
    return [];
  }
  return Array.from({ length: to - from + 1 }, (_, i) => `${s}:${from + i}`);
}

const lines = (await readFile(new URL("src/content/horizons/direction.txt", ROOT), "utf8")).split(/\r?\n/);
lines.forEach((raw, i) => {
  const where = `direction.txt:${i + 1}`;
  const line = raw.replace(/#.*$/, "").trim();
  if (!line) return;
  const [verb, ...rest] = line.split(/\s+/);
  if (verb === "veil" || verb === "see") {
    for (const r of rest) for (const k of keysOf(r, where)) direction[verb].add(k);
  } else if (verb === "quiet") {
    const refs = rest.filter((x) => /^\d/.test(x));
    const signs = rest.filter((x) => !/^\d/.test(x));
    for (const s of signs) if (!SIGN_IDS.has(s)) problems.push(`${where}: no sign "${s}"`);
    for (const r of refs) for (const k of keysOf(r, where)) {
      const had = direction.quiet.get(k);
      direction.quiet.set(k, signs.length ? new Set([...(had ?? []), ...signs]) : "*");
    }
  } else if (verb === "sign") {
    const [ref, sign, atWord, root] = rest;
    if (!SIGN_IDS.has(sign)) problems.push(`${where}: no sign "${sign}"`);
    if (atWord && atWord !== "at") problems.push(`${where}: expected "at <root>"`);
    for (const k of keysOf(ref, where)) direction.sign.push({ key: k, sign, root, where });
  } else problems.push(`${where}: "${verb}" is not a direction`);
});

/** The word of the ayah carrying a root — or a lemma with those letters, for the words that have no root. */
function wordWith(key, root) {
  const words = ayat.get(key) ?? [];
  const i = words.findIndex(
    (w) => hasRoot(w, root) || w.segs.some((g) => g.lemma && strip(g.lemma).includes(strip(root))),
  );
  return i + 1;
}

// ── one ayah's hours ────────────────────────────────────────────────────────
/**
 * The film's day runs forward only: a sign naming the night, when it is noon,
 * brings on the evening and then the night. An ayah that names the dawn, the
 * night, the sun and the moon one after another would have the sky race
 * through two days to keep up — so where the hours named in one ayah would
 * take more than most of a day to pass through, they are given as the day
 * itself passing once, and each sign keeps its look but not its hour. A `!`
 * on a sign is that: the sign, without its hour.
 */
function settleHours(cues) {
  const hours = cues.filter(([, s]) => HOUR_OF[s] !== undefined);
  // An ayah that already passes a whole day, or crosses it from morning to
  // evening, does not also stop at each hour it names.
  if (cues.some(([, s]) => s === "nightDay" || s === "morningEvening" || s === "shade")) {
    return cues.map(([p, s]) => [p, HOUR_OF[s] !== undefined ? `${s}!` : s]);
  }
  if (hours.length < 2) return cues;
  let at = HOUR_OF[hours[0][1]];
  let travelled = 0;
  for (const [, s] of hours.slice(1)) {
    const d = (HOUR_OF[s] - at + 24) % 24;
    // A few hours behind is held, not wrapped round: see director.ts.
    travelled += d > 21 ? 0 : d;
    at = HOUR_OF[s];
  }
  if (travelled <= 20 || cues.some(([, s]) => s === "nightDay")) return cues;
  const out = cues.map(([p, s]) => [p, HOUR_OF[s] !== undefined ? `${s}!` : s]);
  out.push([hours[0][0], "nightDay"]);
  return out.sort((a, b) => a[0] - b[0]);
}

// ── the land a passage is in, when nothing names one ────────────────────────

const KIND = {
  sea: ["sea", "waves", "twoSeas", "deep", "pearls", "calm"],
  mountains: ["mountains", "strata", "rock", "valley", "spring", "torrent"],
  dunes: ["dunes", "mirage"],
  oasis: ["plants", "crops", "grain", "sprout", "harvest", "green", "pasture", "trees", "palms", "olives", "vines", "fruit", "garden", "river", "revive", "lifecycle"],
};
const REGION_OF_KIND = { sea: "coast", mountains: "mountains", dunes: "dunes", oasis: "oasis" };
/** The land of the Ḥijāz around Makkah, and of the oasis of al-Madīnah. */
const PALETTE = {
  makkah: ["mountains", "dunes", "harrah", "coast", "mountains", "plains"],
  madinah: ["oasis", "harrah", "plains", "oasis", "mountains"],
};
const hash = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;

function regionOf(surah, index, cues) {
  const counts = {};
  for (const [, s] of cues) {
    const base = s.replace(/!$/, "");
    for (const [kind, list] of Object.entries(KIND)) if (list.includes(base)) counts[kind] = (counts[kind] ?? 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best) return REGION_OF_KIND[best[0]];
  const palette = PALETTE[FACTS[surah - 1].place];
  return palette[hash(surah, index + 1) % palette.length];
}

// ── every surah ─────────────────────────────────────────────────────────────

await mkdir(OUT, { recursive: true });
const totals = { cues: 0, veiled: 0, looks: 0, ayat: 0 };
const signCount = {};
const report = [];

for (let s = 1; s <= 114; s++) {
  const facts = FACTS[s - 1];
  const out = [];
  for (let a = 1; a <= facts.ayat; a++) {
    const key = `${s}:${a}`;
    const seen = direction.see.has(key);
    const found = read(key, seen);
    let cues = found.cues;
    let veil = direction.veil.has(key) ? 1 : found.veil;

    const quiet = direction.quiet.get(key);
    if (quiet === "*") cues = [];
    else if (quiet) cues = cues.filter(([, sign]) => !quiet.has(sign));

    for (const d of direction.sign.filter((x) => x.key === key)) {
      let pos = 1;
      if (d.root) {
        pos = wordWith(key, d.root);
        if (!pos) {
          problems.push(`${d.where}: no word with ${d.root} in ${key}`);
          pos = 1;
        }
      }
      cues = cues.filter(([p, sign]) => !(sign === d.sign && p !== pos));
      if (!cues.some(([p, sign]) => p === pos && sign === d.sign)) cues.push([pos, d.sign]);
    }

    if (facts.sajdah.includes(a)) cues.push([found.words, "bow"]);

    // One of each sign, in the order they are recited.
    const once = new Set();
    cues = cues
      .sort((x, y) => x[0] - y[0])
      .filter(([, sign]) => (once.has(sign) ? false : (once.add(sign), true)));
    if (veil === 1) cues = cues.filter(([, sign]) => sign === "bow");
    else if (veil) cues = cues.filter(([p, sign]) => p < veil || sign === "bow");
    cues = settleHours(cues);

    const look = veil === 1 ? 0 : found.look;
    out.push([cues, veil, look]);
    totals.ayat++;
    totals.cues += cues.length;
    if (veil) totals.veiled++;
    if (look) totals.looks++;
    for (const [, sign] of cues) signCount[sign.replace(/!$/, "")] = (signCount[sign.replace(/!$/, "")] ?? 0) + 1;
  }

  const passages = (await passagesOf(s)).map((p, i) => {
    const cues = out.slice(p.from - 1, p.to).flatMap(([c]) => c);
    return [p.from, p.to, regionOf(s, i, cues), p.title];
  });

  const score = { v: 1, surah: s, place: facts.place, passages, ayat: out };
  await writeFile(new URL(`${s}.json`, OUT), JSON.stringify(score) + "\n", "utf8");
  if (stats) {
    const veiled = out.filter(([, v]) => v).length;
    report.push(
      `${String(s).padStart(3)}  ${String(out.reduce((n, [c]) => n + c.length, 0)).padStart(4)} signs  ` +
        `${String(veiled).padStart(3)}/${String(facts.ayat).padEnd(3)} veiled  ${passages.map((p) => p[2]).join(" ")}`,
    );
  }
}

for (const lemma of [...Object.keys(LEXICON), ...UNSEEN]) {
  if (!used.has(lemma)) problems.push(`lexicon: the corpus has no lemma ${lemma}`);
}

if (stats) {
  console.log(report.join("\n"));
  console.log(
    Object.entries(signCount)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(" · "),
  );
}
for (const p of problems) console.warn(`! ${p}`);
console.log(
  `wrote public/horizons/ — ${totals.cues} signs in ${totals.ayat} ayat, ${totals.veiled} veiled, ` +
    `${totals.looks} that look${problems.length ? `, ${problems.length} problems` : ""}`,
);
if (problems.some((p) => !p.startsWith("lexicon:"))) process.exitCode = 1;
