// POST /api/email/resend-events  ·  Resend tells us about bounces and spam complaints.
// Set up: Resend dashboard > Webhooks > add this URL with the events email.bounced, email.complained and email.suppressed,
// then save its signing secret (whsec_...) as the Cloudflare secret RESEND_WEBHOOK_SECRET.
import { verifyResendWebhook } from "../../../lib/resend.js";

const ok = (s = "ok", c = 200) => new Response(s, { status: c });

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  if (!(await verifyResendWebhook(env, request.headers, body))) return ok("unauthorised", 401);
  let e; try { e = JSON.parse(body); } catch { return ok("bad json", 400); }
  const d = e.data || {}, to = (Array.isArray(d.to) ? d.to : [d.to]).filter(Boolean).map((x) => String(x).toLowerCase());
  let sql = null;
  if (e.type === "email.bounced" && d.bounce && d.bounce.type === "Permanent") sql = "UPDATE people SET email_status = 'bounced' WHERE email = ?1";
  if (e.type === "email.suppressed") sql = "UPDATE people SET email_status = 'bounced' WHERE email = ?1"; // Resend already blocks this address
  if (e.type === "email.complained") sql = "UPDATE people SET email_status = 'complained', email_opt_out = 1 WHERE email = ?1";
  if (sql) for (const addr of to) await env.DB.prepare(sql).bind(addr).run();
  return ok();
}
