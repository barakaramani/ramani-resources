// Keep test copies out of Google: anything served on a pages.dev address is marked noindex.
// Once ramani.io is connected, the live pages are indexed as normal.
export async function onRequest({ request, next }) {
  const res = await next();
  if (new URL(request.url).hostname.endsWith(".pages.dev")) {
    const r = new Response(res.body, res);
    r.headers.set("X-Robots-Tag", "noindex, nofollow");
    return r;
  }
  return res;
}
