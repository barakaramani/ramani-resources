// Staff only (Cloudflare Access). GET ?segment=all → how many people it reaches.
// POST {subject, preheader, body, segment, test_to?} → send a test to one address, or create the campaign and its recipient list.
import { json, staff, id } from "../../../lib/contact.js";
import { segmentWhere, formatBody } from "../../../lib/segments.js";
import { sendToPerson } from "../../../lib/email.js";

export async function onRequestGet({ request, env }) {
  if (!(await staff(request, env))) return json({ error: "staff_only" }, 401);
  try { const [w, a] = segmentWhere(new URL(request.url).searchParams.get("segment"));
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM people WHERE " + w).bind(...a).first(); return json({ count: r.n }); }
  catch (e) { return json({ error: e.message }, 400); }
}

export async function onRequestPost({ request, env }) {
  const who = (await staff(request, env)); if (!who) return json({ error: "staff_only" }, 401);
  const b = await request.json().catch(() => ({}));
  const subject = String(b.subject || "").trim().slice(0, 150), body = String(b.body || "").slice(0, 20000), pre = String(b.preheader || "").slice(0, 150);
  if (!subject || !body) return json({ error: "subject_and_body_needed" }, 400);
  if (b.test_to) {
    const r = await sendToPerson(env, { id: "test", email: String(b.test_to), lang: b.lang || "en", email_consent: 1 }, { kind: "service", subject: "[TEST] " + subject, preheader: pre, body: formatBody(body, "Juma") });
    return json(r);
  }
  let w, a; try { [w, a] = segmentWhere(b.segment); } catch (e) { return json({ error: e.message }, 400); }
  const cid = id("cmp_"), now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO campaigns (id, subject, preheader, body, segment, created_by, created_at, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'sending')").bind(cid, subject, pre, body, String(b.segment || "all"), who, now).run();
  const people = await env.DB.prepare("SELECT id FROM people WHERE " + w).bind(...a).all();
  const ids = (people.results || []).map((p) => p.id);
  for (let i = 0; i < ids.length; i += 50) {
    await env.DB.batch(ids.slice(i, i + 50).map((pid) => env.DB.prepare("INSERT OR IGNORE INTO email_sends (id, campaign_id, person_id, kind, status, at) VALUES (?1, ?2, ?3, 'marketing', 'pending', ?4)").bind(id("es_"), cid, pid, now)));
  }
  return json({ campaign_id: cid, recipients: ids.length });
}
