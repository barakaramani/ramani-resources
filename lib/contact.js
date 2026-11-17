// Shared helpers: contact normalising, JSON replies, staff check.
export function phone(p) {
  p = String(p || "").replace(/[^\d+]/g, ""); if (p[0] === "+") p = p.slice(1); if (p.startsWith("00")) p = p.slice(2);
  if (/^0[67]\d{8}$/.test(p)) p = "255" + p.slice(1); else if (/^[67]\d{8}$/.test(p)) p = "255" + p;
  return /^\d{9,15}$/.test(p) ? "+" + p : null;
}
export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
export const id = (p) => p + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
// Staff only routes sit behind Cloudflare Access. We do not trust a plain header (anyone can send one):
// we verify the signed Access token (Cf-Access-Jwt-Assertion) against Ramani's Access team keys.
// Env: ACCESS_TEAM_DOMAIN (for example ramani.cloudflareaccess.com) and ACCESS_AUD (the application's AUD tag).
// Until both are set, every staff route stays closed.
let JWKS = null, JWKS_AT = 0;
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
export async function staff(request, env) {
  const team = env && env.ACCESS_TEAM_DOMAIN, aud = env && env.ACCESS_AUD;
  if (!team || !aud) return null;
  const token = request.headers.get("cf-access-jwt-assertion"); if (!token) return null;
  const [h, p, sig] = token.split("."); if (!h || !p || !sig) return null;
  let head, body; try { head = JSON.parse(new TextDecoder().decode(b64u(h))); body = JSON.parse(new TextDecoder().decode(b64u(p))); } catch { return null; }
  if (head.alg !== "RS256") return null;
  if (!JWKS || Date.now() - JWKS_AT > 3600e3) { const r = await fetch(`https://${team}/cdn-cgi/access/certs`); if (!r.ok) return null; JWKS = (await r.json()).keys || []; JWKS_AT = Date.now(); }
  const jwk = JWKS.find((k) => k.kid === head.kid); if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(sig), new TextEncoder().encode(h + "." + p));
  const now = Date.now() / 1000, auds = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (!ok || !auds.includes(aud) || !(body.exp > now) || body.iss !== `https://${team}`) return null;
  return body.email || null;
}

// Everything one person did, oldest first, as {type, data, at}.
export async function activity(env, personId) {
  const r = await env.DB.prepare("SELECT type, received_at, data FROM submissions WHERE person_id = ?1 ORDER BY received_at").bind(personId).all();
  return (r.results || []).map((x) => { let d = {}; try { d = JSON.parse(x.data).data || {}; } catch {} return { type: x.type, at: x.received_at, data: d }; });
}
