/**
 * A relay between this site and tafsir.app.
 *
 * Read `src/lib/quran/tafsirApp.ts` first. tafsir.app does not let a page on
 * another site read its passages, and this site has no server to ask for them
 * on the browser's behalf. This is that server, and nothing more: it passes
 * one request for one passage through to tafsir.app and hands the answer back
 * with the header a browser needs in order to be allowed to read it.
 *
 * Before running this anywhere but your own machine, ask. tafsir.app is a
 * free project run by Nuqayah on donations; it publishes no API, and every
 * passage this relays is served by them. An email saying what Mishkāt is and
 * asking whether they would rather allow your site's address directly — which
 * makes this file unnecessary — is the right first step.
 *
 * It is deliberately narrow:
 *
 *   - one path, `/get.php`, and only the three parameters that name a passage;
 *   - only the origins listed in ALLOW_ORIGIN are answered, so it cannot be
 *     used as an open door to tafsir.app by anyone who finds it;
 *   - answers are kept, so a passage read a thousand times here is asked of
 *     tafsir.app once.
 *
 * Locally, with `NEXT_PUBLIC_TAFSIR_APP_BASE=http://localhost:8787` in
 * `.env.local`:
 *
 *   node scripts/tafsir-proxy.mjs     (in one terminal)
 *   npm run dev                       (in another)
 *
 * Deployed, the `handle` function below is a standard fetch handler and runs
 * unchanged on Cloudflare Workers, Deno Deploy or Bun:
 *
 *   import { handle } from "./tafsir-proxy.mjs";
 *   export default { fetch: (request) => handle(request, { allow: ["https://your.site"] }) };
 */

const UPSTREAM = "https://tafsir.app/get.php";

/** A work's name on tafsir.app: lower-case words joined by hyphens. */
const SOURCE = /^[a-z][a-z-]{1,40}$/;

const kept = new Map();
const KEEP = 2000;

function reply(body, status, origin, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      ...extra,
    },
  });
}

/**
 * @param {Request} request
 * @param {{ allow: string[] }} options origins that may read through this relay
 */
export async function handle(request, { allow }) {
  const origin = request.headers.get("Origin") ?? "";
  const permitted = allow.includes(origin) ? origin : "";

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: permitted ? 204 : 403,
      headers: permitted
        ? { "Access-Control-Allow-Origin": permitted, "Access-Control-Allow-Methods": "GET", Vary: "Origin" }
        : {},
    });
  }
  if (!permitted) return new Response("This relay answers the site it was set up for.", { status: 403 });
  if (request.method !== "GET") return reply('{"error":"GET only"}', 405, permitted);

  const url = new URL(request.url);
  const src = url.searchParams.get("src") ?? "";
  const s = Number(url.searchParams.get("s"));
  const a = Number(url.searchParams.get("a"));
  const named =
    url.pathname.endsWith("/get.php") &&
    SOURCE.test(src) &&
    Number.isInteger(s) && s >= 1 && s <= 114 &&
    Number.isInteger(a) && a >= 1 && a <= 286;
  if (!named) return reply('{"error":"not a passage"}', 400, permitted);

  const key = `${src}/${s}/${a}`;
  // A tafsir written centuries ago does not change between requests.
  const lasting = { "Cache-Control": "public, max-age=2592000, immutable" };

  const hit = kept.get(key);
  if (hit) return reply(hit, 200, permitted, lasting);

  let upstream;
  try {
    upstream = await fetch(`${UPSTREAM}?src=${src}&s=${s}&a=${a}&ver=1`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return reply('{"error":"tafsir.app could not be reached"}', 502, permitted);
  }
  if (!upstream.ok) return reply('{"error":"tafsir.app refused"}', 502, permitted);

  const body = await upstream.text();
  if (kept.size >= KEEP) kept.delete(kept.keys().next().value);
  kept.set(key, body);
  return reply(body, 200, permitted, lasting);
}

// ── run directly: a local server for development ───────────────────────────
// Only under Node, and only when this file is the one that was run — imported
// by a Worker, there is no `process` and nothing below happens.
const script = typeof process !== "undefined" ? process.argv?.[1] : undefined;
const direct = script
  ? import.meta.url === (await import("node:url")).pathToFileURL(script).href
  : false;

if (direct) {
  const { createServer } = await import("node:http");
  const port = Number(process.env.PORT ?? 8787);
  const allow = (process.env.ALLOW_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  createServer(async (req, res) => {
    const request = new Request(`http://localhost:${port}${req.url}`, {
      method: req.method,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter((h) => typeof h[1] === "string"),
      ),
    });
    const response = await handle(request, { allow });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  }).listen(port, () => {
    console.log(`tafsir.app relay on http://localhost:${port} — answering ${allow.join(", ")}`);
  });
}
