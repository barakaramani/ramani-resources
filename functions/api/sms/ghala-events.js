// POST /api/sms/ghala-events  ·  Ghala tells us about SMS replies from customers and delivery reports.
// Set up: Ghala dashboard > Developer > Events > add this URL, then save the signing secret as GHALA_WEBHOOK_SECRET.
import { verifyGhalaWebhook, normaliseGhala } from "../../../lib/ghala.js";
import { handleInboundSms } from "../../../lib/sms.js";
import { json } from "../../../lib/contact.js";

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  if (!(await verifyGhalaWebhook(env, request.headers, body))) return json({ error: "unauthorised" }, 401);
  let p; try { p = JSON.parse(body); } catch { return json({ error: "bad_json" }, 400); }
  const e = normaliseGhala(request.headers.get("x-ghala-event"), p);
  if (e.type === "sms.received" && e.text) {
    const r = await handleInboundSms(env, { ...e, external_id: e.external_id || request.headers.get("x-ghala-delivery"), raw: p, source: "ghala" });
    return json({ ok: true, outcome: r.outcome });
  }
  if (e.type === "sms.status" && e.external_id) { // sent SMS are logged with their Ghala id; mark the ones that failed
    if (e.status === "FAILED" || e.status === "UNDELIVERED") await env.DB.prepare("UPDATE calls SET sms_status = 'failed' WHERE sms_message_id = ?1").bind(e.external_id).run().catch(() => {});
    if (e.status === "DELIVERED") await env.DB.prepare("UPDATE calls SET sms_status = 'delivered' WHERE sms_message_id = ?1").bind(e.external_id).run().catch(() => {});
    return json({ ok: true, status: e.status });
  }
  return json({ ok: true, ignored: e.type });
}
