// Real, shareable and indexable address for every Learn post: /learn/<link>.
// Serves the Learn page with the post's title, description, canonical link and social preview built in on the
// server, plus the article text for crawlers that do not run JavaScript. The page then shows the post as usual.
import { livePost, clean, esc } from "../../lib/learn.js";

export async function onRequestGet({ request, env, params }) {
  const page = await env.ASSETS.fetch(new URL("/", request.url));
  let html = await page.text();
  let p = null;
  try { if (env.DB) p = await livePost(env, String(params.slug || "").toLowerCase()); } catch {}
  const site = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  let head = '<base href="/">';
  if (p) {
    const title = esc((p.seoTitle || p.title) + " | Ramani Learn");
    const desc = esc(p.metaDesc || p.subtitle || p.excerpt || "");
    const url = site + "/learn/" + p.id;
    const img = p.coverUrl ? (/^https?:/.test(p.coverUrl) ? p.coverUrl : site + p.coverUrl) : "";
    head += `<title>${title}</title><meta name="description" content="${desc}"><link rel="canonical" href="${esc(url)}">` +
      `<meta property="og:type" content="article"><meta property="og:site_name" content="Ramani"><meta property="og:title" content="${title}">` +
      `<meta property="og:description" content="${desc}"><meta property="og:url" content="${esc(url)}">` +
      (img ? `<meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`);
  } else {
    head += '<title>Not found | Ramani Learn</title><meta name="robots" content="noindex">';
  }
  // after the charset tag, so the browser still finds it in the first bytes of the page
  html = /<meta charset=utf8>/i.test(html) ? html.replace(/<meta charset=utf8>/i, (m) => m + head) : html.replace(/<head>/i, "<head>" + head);
  if (p) html = html.replace(/<body([^>]*)>/i, (m) => m + `<noscript><article><h1>${esc(p.title)}</h1>${clean(p.html)}</article></noscript>`);
  return new Response(html, { status: p ? 200 : 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120" } });
}
