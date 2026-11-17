// Shared helpers: contact normalising, JSON replies, staff check.
export function phone(p) {
  p = String(p || "").replace(/[^\d+]/g, ""); if (p[0] === "+") p = p.slice(1); if (p.startsWith("00")) p = p.slice(2);
  if (/^0[67]\d{8}$/.test(p)) p = "255" + p.slice(1); else if (/^[67]\d{8}$/.test(p)) p = "255" + p;
  return /^\d{9,15}$/.test(p) ? "+" + p : null;
}
export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
export const id = (p) => p + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
// Staff only routes sit behind Cloudflare Access, which adds this header after the staff member signs in.
export function staff(request) { return request.headers.get("cf-access-authenticated-user-email") || null; }

// Everything one person did, oldest first, as {type, data, at}.
export async function activity(env, personId) {
  const r = await env.DB.prepare("SELECT type, received_at, data FROM submissions WHERE person_id = ?1 ORDER BY received_at").bind(personId).all();
  return (r.results || []).map((x) => { let d = {}; try { d = JSON.parse(x.data).data || {}; } catch {} return { type: x.type, at: x.received_at, data: d }; });
}
