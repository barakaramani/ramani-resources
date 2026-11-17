// 1. Keep test copies out of Google: anything served on a pages.dev address is marked noindex.
//    Once ramani.io is connected, the live pages are indexed as normal.
// 2. data/live.js gets today's exchange rates (lib/fx.js) and a note that rates may vary.
//    If the rate source is down, the saved rates in the file are used and the note still shows.
import { liveRates, liveScript } from "../lib/fx.js";

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  let res = await next();
  if (url.pathname === "/data/live.js" && res.ok) {
    let fx = null;
    try { fx = await liveRates(); } catch {}
    const body = (await res.text()) + liveScript(fx);
    res = new Response(body, { status: 200, headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=1800" } });
  }
  if (url.hostname.endsWith(".pages.dev")) {
    const r = new Response(res.body, res);
    r.headers.set("X-Robots-Tag", "noindex, nofollow");
    return r;
  }
  return res;
}
