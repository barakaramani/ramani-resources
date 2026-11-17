// POST /api/semacall/send-sms {call_id, text?}  ·  Staff only. Sends an SMS draft after a BDM approves it (and may edit it).
// It goes out through Ghala (lib/sms.js), or SemaCall if Ghala is not set up.
import { sendSms } from "../../../lib/sms.js";
import { json, staff } from "../../../lib/contact.js";

export async function onRequestPost({ request, env }) {
  const who = staff(request); if (!who) return json({ error: "staff_only" }, 401);
  const body = await request.json().catch(() => ({}));
  const c = await env.DB.prepare("SELECT c.id, c.sms_draft, c.sms_status, p.phone, p.opt_out FROM calls c JOIN people p ON p.id = c.person_id WHERE c.id = ?1").bind(String(body.call_id || "")).first();
  if (!c) return json({ error: "not_found" }, 404);
  if (c.opt_out) return json({ error: "customer_opted_out" }, 409);
  if (c.sms_status === "sent" || c.sms_status === "delivered") return json({ error: "already_sent" }, 409);
  const text = String(body.text || c.sms_draft || "").slice(0, 480);
  if (!text) return json({ error: "no_text" }, 400);
  if (!c.phone) return json({ error: "no_phone" }, 400);
  let res; try { res = await sendSms(env, { to: c.phone, text, idempotencyKey: "sms_" + c.id }); }
  catch (e) { return json({ error: "sms_failed", detail: e.message.slice(0, 200) }, 502); }
  await env.DB.prepare("UPDATE calls SET sms_draft = ?2, sms_status = 'sent', bdm = COALESCE(bdm, ?3) WHERE id = ?1").bind(c.id, text, who).run();
  // needs schema_v4.sql; ignored if not run yet
  await env.DB.prepare("UPDATE calls SET sms_message_id = ?2, sms_provider = ?3 WHERE id = ?1").bind(c.id, res.id || null, res.provider).run().catch(() => {});
  return json({ ok: true, provider: res.provider, message_id: res.id || null });
}
