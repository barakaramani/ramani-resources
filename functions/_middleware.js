// Runs in front of every page and API request.
// 1. Rate limiting for the API (lib/ratelimit.js): too many requests from one IP get 429 with Retry-After.
// 2. Learn images uploaded in the staff editor live in R2 (binding LEARN_IMAGES) and are served at /_blob/<id>.
// 3. data/live.js gets today's exchange rates (lib/fx.js) and a note that rates may vary.
//    If the rate source is down, the saved rates in the file are used and the note still shows.
// 4. Security headers on every response (see docs/SECURITY.md).
// 5. Keep test copies out of Google: anything served on a pages.dev address is marked noindex.
//    Once ramani.io is connected, the live pages are indexed as normal.
import { liveRates, liveScript } from "../lib/fx.js";
import { ruleFor, overLimit } from "../lib/ratelimit.js";

// Content Security Policy. Inline scripts and styles are allowed because the pages are built with them;
// everything else is limited to this site plus the few services the pages really use:
// Google Fonts, Cloudflare Turnstile, PostHog analytics (only loads after cookie consent) and YouTube embeds.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://eu-assets.i.posthog.com https://us-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://challenges.cloudflare.com https://*.posthog.com",
  "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://www.youtube.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
};

function secure(res, url) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) r.headers.set(k, v);
  const type = r.headers.get("content-type") || "";
  if (type.includes("text/html")) r.headers.set("Content-Security-Policy", CSP);
  if (url.pathname.startsWith("/api/") && !r.headers.has("cache-control")) r.headers.set("Cache-Control", "no-store");
  if (url.hostname.endsWith(".pages.dev")) r.headers.set("X-Robots-Tag", "noindex, nofollow");
  return r;
}

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);

  const rule = ruleFor(request.method, url.pathname);
  if (rule) {
    const over = await overLimit(env, request, rule);
    if (over) {
      return secure(new Response(JSON.stringify({ ok: false, error: "too_many_requests", retry_after: over.retryAfter }), {
        status: 429, headers: { "content-type": "application/json", "retry-after": String(over.retryAfter) },
      }), url);
    }
  }

  if (url.pathname.startsWith("/_blob/")) {
    const key = url.pathname.slice(7);
    const obj = env.LEARN_IMAGES && /^[a-f0-9]{32}\.(png|jpg|webp|gif)$/.test(key) ? await env.LEARN_IMAGES.get("learn/" + key) : null;
    if (!obj) return secure(new Response("Not found", { status: 404 }), url);
    return secure(new Response(obj.body, { headers: { "content-type": (obj.httpMetadata && obj.httpMetadata.contentType) || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" } }), url);
  }

  let res = await next();
  if (url.pathname === "/data/live.js" && res.ok) {
    let fx = null;
    try { fx = await liveRates(); } catch {}
    const body = (await res.text()) + liveScript(fx);
    res = new Response(body, { status: 200, headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=1800" } });
  }
  return secure(res, url);
}
