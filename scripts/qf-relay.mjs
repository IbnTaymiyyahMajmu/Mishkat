/**
 * A relay between this site and the Quran Foundation's Content API.
 *
 * Read the head of `src/lib/quran/api.ts` first. The Foundation serves its
 * corpus to registered applications at `apis.quran.foundation`, and every
 * request there carries a token. The token is had by presenting a client
 * secret, and the secret is the one thing this site cannot hold: it is a
 * static export, and whatever is in its pages is in every reader's browser.
 * The Foundation's own rule is the same — "A browser or mobile app must not
 * embed a Content API client_secret" — and its answer is this: a small server
 * that holds the secret, asks for the token, and passes the reader's request
 * on with it.
 *
 * That is all this is. It adds nothing to the answers and keeps nothing of
 * the reader's.
 *
 * It is deliberately narrow:
 *
 *   - GET only, and only the Content API's own families of path, so it cannot
 *     be used to reach anything else with this site's credentials;
 *   - only the origins it is told of are answered, so it is not an open door
 *     to the Foundation's API for whoever finds it;
 *   - one token is asked for and shared until just before it lapses; a 401 is
 *     answered by asking once more, and never in a loop;
 *   - answers are kept for under a week and no longer — the Foundation's terms
 *     allow a copy seven days, and its own servers say the same of each answer;
 *   - neither the secret nor a token is ever written to a log.
 *
 * The two environments. An application begins in *pre-live*, whose corpus is
 * al-Fātiḥah and al-Baqarah and fourteen translations: enough to prove the
 * wiring, not to read the Qur'an by. Production — all 114 surahs and the whole
 * catalogue — is a permission asked for in the Foundation's Developer Console,
 * and comes with credentials of its own. Tokens do not cross between them.
 *
 * Locally, with the credentials in `.env.local` (which git ignores):
 *
 *   QF_CLIENT_ID=…
 *   QF_CLIENT_SECRET=…
 *   QF_ENV=prelive                                  (or production)
 *   NEXT_PUBLIC_QF_RELAY=http://localhost:8788      (what tells the site to use it)
 *
 *   npm run relay:qf      (in one terminal)
 *   npm run dev           (in another)
 *
 * Deployed, `relay` returns a standard fetch handler and runs unchanged on
 * Cloudflare Workers, Deno Deploy or Bun, with the three values as secrets of
 * that platform:
 *
 *   import { relay } from "./qf-relay.mjs";
 *   let handle;
 *   export default {
 *     fetch: (request, env) =>
 *       (handle ??= relay({
 *         clientId: env.QF_CLIENT_ID,
 *         clientSecret: env.QF_CLIENT_SECRET,
 *         env: env.QF_ENV,
 *         allow: ["https://your.site"],
 *       }))(request),
 *   };
 */

const HOSTS = {
  prelive: {
    auth: "https://prelive-oauth2.quran.foundation",
    api: "https://apis-prelive.quran.foundation",
  },
  production: {
    auth: "https://oauth2.quran.foundation",
    api: "https://apis.quran.foundation",
  },
};

/** The Content API's families of path. Anything else is not passed on. */
const FAMILIES = new Set([
  "chapters",
  "verses",
  "quran",
  "resources",
  "translations",
  "tafsirs",
  "foot_notes",
  "recitations",
  "chapter_recitations",
  "audio",
  "juzs",
  "hizbs",
  "rub_el_hizbs",
  "rukus",
  "manzils",
  "pages",
  "hadith_references",
  "answers",
]);

const PATH = /^\/content\/api\/v4\/([a-z_]+)((?:\/[A-Za-z0-9:_.-]+)*)\/?$/;

/** Short of the week the terms allow, so a copy is never the one day over. */
const KEEP_MS = 6 * 24 * 60 * 60 * 1000;
const KEEP = 4000;

/** The token is asked for again this long before it would lapse. */
const EARLY_MS = 30_000;

/**
 * @param {{ clientId: string, clientSecret: string, env?: string, allow: string[] }} options
 * @returns {(request: Request) => Promise<Response>}
 */
export function relay({ clientId, clientSecret, env = "prelive", allow }) {
  const host = HOSTS[env];
  if (!host) throw new Error("QF_ENV must be 'prelive' or 'production'");
  if (!clientId || !clientSecret) throw new Error("QF_CLIENT_ID and QF_CLIENT_SECRET are both needed");

  let token = "";
  let lapses = 0;
  /** One request for a token at a time, however many readers are waiting on it. */
  let asking = null;

  async function ask() {
    const res = await fetch(`${host.auth}/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "content" }),
    });
    if (!res.ok) throw new Error(`The Foundation refused a token (${res.status})`);
    const answer = await res.json();
    token = answer.access_token;
    lapses = Date.now() + answer.expires_in * 1000;
    return token;
  }

  function current() {
    if (token && Date.now() < lapses - EARLY_MS) return Promise.resolve(token);
    asking ??= ask().finally(() => {
      asking = null;
    });
    return asking;
  }

  const upstream = async (target) =>
    fetch(target, { headers: { "x-auth-token": await current(), "x-client-id": clientId } });

  /** What has been answered already, and when. Oldest out first. */
  const kept = new Map();

  return async function handle(request) {
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

    const reply = (body, status, extra = {}) =>
      new Response(body, {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": permitted,
          Vary: "Origin",
          ...extra,
        },
      });

    if (request.method !== "GET") return reply('{"error":"GET only"}', 405);

    const url = new URL(request.url);
    const named = PATH.exec(url.pathname);
    if (!named || !FAMILIES.has(named[1]) || url.pathname.includes("..") || url.search.length > 600) {
      return reply('{"error":"not a Content API path"}', 400);
    }

    const key = url.pathname.replace(/\/$/, "") + url.search;
    const hit = kept.get(key);
    if (hit && Date.now() - hit.at < KEEP_MS) {
      const left = Math.floor((KEEP_MS - (Date.now() - hit.at)) / 1000);
      return reply(hit.body, 200, { "Cache-Control": `public, max-age=${left}` });
    }

    let res;
    try {
      res = await upstream(host.api + key);
      // A token the Foundation no longer honours: ask for another, once.
      if (res.status === 401) {
        token = "";
        res = await upstream(host.api + key);
      }
    } catch {
      return reply('{"error":"The Quran Foundation could not be reached"}', 502);
    }

    const body = await res.text();
    if (!res.ok) return reply(body || '{"error":"refused"}', res.status);

    kept.delete(key);
    if (kept.size >= KEEP) kept.delete(kept.keys().next().value);
    kept.set(key, { body, at: Date.now() });
    return reply(body, 200, { "Cache-Control": `public, max-age=${Math.floor(KEEP_MS / 1000)}` });
  };
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
  const { readFileSync, existsSync } = await import("node:fs");

  // Node does not read `.env.local` for a script as Next does for the site, so
  // it is read here: only the three values this needs, and only where the
  // environment has not already been given them.
  const settings = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const set = /^\s*(QF_[A-Z_]+|ALLOW_ORIGIN)\s*=\s*(.*?)\s*$/.exec(line);
      if (set && settings[set[1]] === undefined) settings[set[1]] = set[2].replace(/^["']|["']$/g, "");
    }
  }

  const port = Number(settings.QF_RELAY_PORT ?? 8788);
  const env = settings.QF_ENV ?? "prelive";
  const allow = (settings.ALLOW_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  let handle;
  try {
    handle = relay({ clientId: settings.QF_CLIENT_ID, clientSecret: settings.QF_CLIENT_SECRET, env, allow });
  } catch (error) {
    console.error(`${error.message}. Put them in .env.local — see the head of this file.`);
    process.exit(1);
  }

  createServer(async (req, res) => {
    const request = new Request(`http://localhost:${port}${req.url}`, {
      method: req.method,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter((h) => typeof h[1] === "string"),
      ),
    });
    const response = await handle(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  }).listen(port, () => {
    console.log(
      `Quran Foundation relay (${env}) on http://localhost:${port} — answering ${allow.join(", ")}`,
    );
    if (env === "prelive") {
      console.log("Pre-live holds al-Fātiḥah and al-Baqarah only. Any other surah will not be found.");
    }
  });
}
