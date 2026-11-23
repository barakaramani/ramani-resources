// The Learn editor for Ramani staff: the same Learn page, switched into editor mode.
// Put this path and /api/learn/admin/* behind Cloudflare Access (see LEARN_EDITOR.md). Even without Access
// in front, nobody can save anything: every write is checked on the server against the signed Access token.
export async function onRequestGet({ request, env }) {
  const page = await env.ASSETS.fetch(new URL("/", request.url));
  const html = (await page.text()).replace(/<head>/i, '<head><meta name="robots" content="noindex, nofollow"><script>window.LEARN_ADMIN=true</script>');
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
