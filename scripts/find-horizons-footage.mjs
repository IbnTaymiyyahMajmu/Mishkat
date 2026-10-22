// npm run find:footage
//
// Searches Pixabay for filmed footage for the signs Horizons still lacks good
// clips for, and gathers what it finds for the owner to choose from on the
// review page. It only searches: no video is fetched here. A clip is downloaded
// later by gen:footage, and only once the owner has approved that file.
//
// Pixabay answers only with the owner's API key, read from PIXABAY_API_KEY in
// the environment (never written to a file here). Its rules, from
// https://pixabay.com/api/docs/ and https://pixabay.com/service/terms/:
//   - at most 100 requests a minute, so requests here are spaced out and the
//     X-RateLimit headers are obeyed;
//   - answers are kept for 24 hours, so running this again within a day asks
//     Pixabay nothing it has already been asked;
//   - no systematic mass downloads: a still for each hit kept, nothing more;
//   - where the results are shown, say where they come from: every candidate
//     carries its page and its contributor's name.
// Pixabay asks uploaders to label AI-generated work, but the API does not say
// which hits carry the label. Anything uploaded since 2023 is flagged to be
// checked on its page before it is chosen, and tags that speak of generation or
// rendering are flagged too: generated video counts as drawn, and is not used.
//
// Writes candidates.json and a still for each candidate to the search folder
// (by default node_modules/.cache/mishkat/horizons-footage/pixabay).
//
//   node scripts/find-horizons-footage.mjs                      every sign below
//   node scripts/find-horizons-footage.mjs --only naba:rain     one sign, or several joined by commas
//   node scripts/find-horizons-footage.mjs --no-stills          leave out the preview stills
//   node scripts/find-horizons-footage.mjs --out <dir>          write somewhere else

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fromRoot = (p) => (isAbsolute(p) ? p : resolve(ROOT, p));

const OUT = fromRoot(option("--out") ?? "node_modules/.cache/mishkat/horizons-footage/pixabay");
const ANSWERS = join(OUT, "answers");
const STILLS = join(OUT, "stills");
const ONLY = option("--only")?.split(",");
const WITH_STILLS = !flag("--no-stills");
const API = process.env.PIXABAY_API ?? "https://pixabay.com/api/videos/";
const KEY = process.env.PIXABAY_API_KEY?.trim();

/** How long an answer is kept before Pixabay is asked again. */
const KEEP = 24 * 60 * 60 * 1000;

/** The least time between two requests: 100 a minute is the limit, so this stays well under it. */
const SPACING = 1200;

/** Hits kept per sign, best first, for the review page. */
const PER_SIGN = 12;

/** Before this, Pixabay's uploads are the work of cameras; after it, a clip may be generated and must be checked. */
const AI_ERA = "2023-01-01";

/** Tags that suggest a clip was generated or rendered, not filmed. */
const MADE = /\b(ai|generative|midjourney|stable diffusion|sora|kling|veo|cgi|3d|render(ed|ing)?|animation|animated|digital art|illustration|cartoon|motion graphics?)\b/i;

/**
 * What to search for, sign by sign: the signs whose clips so far are only
 * 720p under Mixkit's restricted licence, or that lack night shots, or that
 * need more bare land to drift under the veil. Pixabay matches every word of a
 * query against its tags, so queries are kept to a word or three. `width` is
 * the narrowest clip accepted (1920 unless a sign is too rare to be choosy).
 */
const SEARCHES = [
  { sign: "naba:pairs", q: ["elderly couple", "couple walking", "couple silhouette", "family walking", "family sunset", "muslim family"] },
  { sign: "naba:sleep", q: ["baby sleeping", "newborn sleeping", "sleeping baby", "child sleeping"] },
  { sign: "naba:night", q: ["day to night", "dusk timelapse", "night timelapse desert", "sunset night timelapse"] },
  { sign: "naba:day", q: ["harvest", "farmer field", "wheat harvest", "shepherd", "fishermen"] },
  { sign: "naba:rain", q: ["rain clouds", "rain shaft", "heavy rain", "downpour", "rain storm", "rain falling"] },
  { sign: "naba:plants", q: ["seed germination", "sprout timelapse", "plant growing", "wheat field"] },
  { sign: "naba:gardens", q: ["palm grove", "date palms", "orchard", "oasis", "forest aerial"] },
  { sign: "naba:veil", q: ["desert aerial", "sand dunes aerial", "dunes drone", "desert landscape"] },
  { sign: "isra:haram", q: ["mecca", "kaaba", "makkah", "masjid al haram", "mecca night"], width: 1280 },
  { sign: "isra:nightRoad", q: ["desert night", "desert moon", "moonlight desert", "night desert aerial"] },
  { sign: "isra:aqsa", q: ["dome of the rock", "al aqsa", "jerusalem", "jerusalem night", "jerusalem old city"], width: 1280 },
  { sign: "kursi:predawn", q: ["milky way desert", "night to day", "stars timelapse", "dawn timelapse"] },
];

// ── asking Pixabay ───────────────────────────────────────────────────────────

const pause = (ms) => new Promise((done) => setTimeout(done, ms));
let nextAt = 0;

/** The query as Pixabay is asked it, without the key, which never reaches a file. */
function queryOf(q, width) {
  return new URLSearchParams({
    q,
    lang: "en",
    video_type: "film",
    safesearch: "true",
    min_width: String(width),
    per_page: "50",
  }).toString();
}

/** One search, from the saved answer if it is less than a day old. */
async function search(q, width) {
  const query = queryOf(q, width);
  const file = join(ANSWERS, createHash("sha256").update(query).digest("hex").slice(0, 16) + ".json");
  if (existsSync(file)) {
    const saved = JSON.parse(await readFile(file, "utf8"));
    if (Date.now() - saved.at < KEEP) return saved.answer;
  }
  for (let attempt = 1; ; attempt++) {
    await pause(nextAt - Date.now());
    let res;
    try {
      res = await fetch(`${API}?key=${encodeURIComponent(KEY)}&${query}`);
    } catch (e) {
      if (attempt >= 4) throw new Error(`Pixabay could not be reached for "${q}": ${e.cause?.code ?? e.message}`);
      nextAt = Date.now() + 5000 * attempt;
      continue;
    }
    const header = (name) => (res.headers.has(name) ? Number(res.headers.get(name)) : NaN);
    const left = header("x-ratelimit-remaining");
    const reset = header("x-ratelimit-reset");
    const untilReset = Number.isFinite(reset) ? reset * 1000 + 500 : 60_000;
    nextAt = Date.now() + (left < 2 ? Math.max(SPACING, untilReset) : SPACING);
    if (res.status === 429 && attempt < 4) {
      nextAt = Date.now() + untilReset;
      continue;
    }
    if (!res.ok) {
      const why = (await res.text()).slice(0, 200);
      if (res.status === 400 && /api key/i.test(why)) {
        console.error(`Pixabay refused the key in PIXABAY_API_KEY (${why}). Check it on https://pixabay.com/api/docs/ while logged in.`);
        process.exit(1);
      }
      throw new Error(`Pixabay answered ${res.status} for "${q}": ${why}`);
    }
    const answer = await res.json();
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify({ at: Date.now(), query, answer }));
    await rename(tmp, file);
    return answer;
  }
}

// ── what a hit is worth ──────────────────────────────────────────────────────

/** The day the clip reached Pixabay, read from its file's address (…/video/2015/08/08/…). */
function uploadedOn(hit) {
  const m = /\/video\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(hit.videos?.medium?.url ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * The copy that would be fetched: the smallest at least 1920 wide, since the
 * film is encoded at 1080 at most, or else the largest there is. An empty
 * `large` means Pixabay has no copy at that size.
 */
function toFetch(hit) {
  const copies = ["tiny", "small", "medium", "large"].map((k) => hit.videos?.[k]).filter((v) => v?.url && v.width);
  return copies.find((v) => v.width >= 1920) ?? copies.at(-1);
}

function candidate(hit, sign, found) {
  const [passage, name] = sign.split(":");
  const best = toFetch(hit);
  const uploaded = uploadedOn(hit);
  const flags = [];
  if (!uploaded || uploaded >= AI_ERA)
    flags.push(`Uploaded ${uploaded ?? "on an unknown day"}, since AI video arrived: check its page for Pixabay's AI-generated label before choosing`);
  if (MADE.test(hit.tags ?? "")) flags.push(`Tags suggest it may be generated or rendered (${hit.tags})`);
  return {
    id: `pixabay-${hit.id}--${passage}-${name}`,
    clip: `pixabay-${hit.id}`,
    passage,
    sign: name,
    source: "Pixabay",
    title: hit.tags,
    page: hit.pageURL,
    licence: "pixabay",
    licenceLabel: "Pixabay Content License",
    credit: `by ${hit.user} via Pixabay`,
    user: hit.user,
    userPage: `https://pixabay.com/users/${hit.user}-${hit.user_id}/`,
    uploaded,
    res: best ? `${best.width}×${best.height}` : null,
    seconds: hit.duration,
    sizeMB: best ? Math.round(best.size / 1e5) / 10 : null,
    url: best?.url ?? null,
    renditions: Object.fromEntries(
      Object.entries(hit.videos ?? {})
        .filter(([, v]) => v.url)
        .map(([k, v]) => [k, { url: v.url, width: v.width, height: v.height, size: v.size }]),
    ),
    still: hit.videos?.tiny?.thumbnail || hit.videos?.small?.thumbnail || null,
    preview: null,
    found,
    popularity: { views: hit.views, downloads: hit.downloads, likes: hit.likes },
    flags,
  };
}

// ── stills ───────────────────────────────────────────────────────────────────

async function keepStill(c) {
  const file = join(STILLS, `${c.clip}.jpg`);
  if (!existsSync(file)) {
    await pause(400);
    const res = await fetch(c.still);
    if (!res.ok) return console.warn(`  no still for ${c.clip}: ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  c.preview = `stills/${c.clip}.jpg`;
}

// ── main ─────────────────────────────────────────────────────────────────────

if (!KEY) {
  console.error(
    "PIXABAY_API_KEY is not set. Pixabay answers only with its owner's API key: add it to this\n" +
      "environment as PIXABAY_API_KEY (in the cloud, in the environment's settings; on a computer,\n" +
      "in the shell), then run this again. The key is never written to a file.",
  );
  process.exit(1);
}

const wanted = SEARCHES.filter((s) => !ONLY || ONLY.includes(s.sign));
if (!wanted.length) {
  console.error(`No sign called ${ONLY.join(", ")}. The signs searched are: ${SEARCHES.map((s) => s.sign).join(", ")}`);
  process.exit(1);
}
await mkdir(ANSWERS, { recursive: true });
if (WITH_STILLS) await mkdir(STILLS, { recursive: true });

const candidates = [];
for (const { sign, q, width = 1920 } of wanted) {
  /** @type {Map<number, {hit: any, found: string[], rank: number}>} */
  const hits = new Map();
  for (const query of q) {
    const answer = await search(query, width);
    answer.hits.forEach((hit, i) => {
      const seen = hits.get(hit.id);
      if (seen) {
        seen.found.push(query);
        seen.rank = Math.min(seen.rank, i);
      } else hits.set(hit.id, { hit, found: [query], rank: i });
    });
    console.log(`${sign.padEnd(15)} "${query}": ${answer.hits.length} of ${answer.totalHits}`);
  }
  // Best first: found by more of the sign's queries, then higher in Pixabay's own order.
  const best = [...hits.values()].sort((a, b) => b.found.length - a.found.length || a.rank - b.rank).slice(0, PER_SIGN);
  for (const { hit, found } of best) {
    const c = candidate(hit, sign, found);
    if (WITH_STILLS && c.still) await keepStill(c);
    candidates.push(c);
  }
}

await writeFile(
  join(OUT, "candidates.json"),
  JSON.stringify({ searched: new Date().toISOString(), source: "https://pixabay.com/", candidates }, null, 1) + "\n",
);
const flagged = candidates.filter((c) => c.flags.length).length;
console.log(`\n${candidates.length} candidates (${flagged} flagged to check) in ${join(OUT, "candidates.json")}`);
