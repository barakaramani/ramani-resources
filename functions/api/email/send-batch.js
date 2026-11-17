// Staff only. POST {campaign_id} → sends the next 40 pending emails of a campaign. The newsletter page calls this until nothing is left.
import { json, staff } from "../../../lib/contact.js";
import { formatBody } from "../../../lib/segments.js";
import { sendToPerson } from "../../../lib/email.js";

export async function onRequestPost({ request, env }) {
  if (!staff(request)) return json({ error: "staff_only" }, 401);
  const b = await request.json().catch(() => ({}));
  const c = await env.DB.prepare("SELECT * FROM campaigns WHERE id = ?1").bind(String(b.campaign_id || "")).first();
  if (!c) return json({ error: "not_found" }, 404);
  const rows = await env.DB.prepare("SELECT s.id AS send_id, p.id, p.name, p.email, p.lang, p.email_consent, p.email_opt_out, p.email_status FROM email_sends s JOIN people p ON p.id = s.person_id WHERE s.campaign_id = ?1 AND s.status = 'pending' LIMIT 40").bind(c.id).all();
  let sent = 0, failed = 0, skipped = 0, quota = false;
  for (const p of rows.results || []) {
    let status = "sent", err = null, mid = null;
    try {
      const r = await sendToPerson(env, p, { kind: "marketing", subject: c.subject, preheader: c.preheader, body: formatBody(c.body, String(p.name || "").split(" ")[0]), tags: [["campaign", c.id]], idempotencyKey: "send_" + p.send_id });
      if (r.skipped) { status = "skipped"; err = r.skipped; skipped++; } else { mid = r.message_id; sent++; }
    } catch (e) {
      if (/quota/i.test(e.message)) { quota = true; break; } // daily or monthly email quota used up: leave the rest pending and resume later
      status = "failed"; err = e.message.slice(0, 300); failed++;
    }
    await env.DB.prepare("UPDATE email_sends SET status = ?2, at = ?3, message_id = ?4, error = ?5 WHERE id = ?1").bind(p.send_id, status, new Date().toISOString(), mid, err).run();
  }
  const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM email_sends WHERE campaign_id = ?1 AND status = 'pending'").bind(c.id).first();
  await env.DB.prepare("UPDATE campaigns SET sent = sent + ?2, failed = failed + ?3, status = CASE WHEN ?4 = 0 THEN 'sent' ELSE 'sending' END WHERE id = ?1").bind(c.id, sent, failed, left.n).run();
  return json({ sent, failed, skipped, remaining: left.n, quota_reached: quota });
}
