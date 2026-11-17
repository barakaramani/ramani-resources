// POST /api/email/ses-events?token=SNS_TOKEN  ·  Amazon SNS tells us about bounces and spam complaints from SES.
// Set up: SES configuration set (SES_CONFIG_SET) > event destination > SNS topic (SES_SNS_TOPIC_ARN) > HTTPS subscription to this URL with the token.
const ok = (s = "ok", c = 200) => new Response(s, { status: c });

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (!env.SNS_TOKEN || url.searchParams.get("token") !== env.SNS_TOKEN) return ok("unauthorised", 401);
  const m = JSON.parse(await request.text() || "{}");
  if (env.SES_SNS_TOPIC_ARN && m.TopicArn !== env.SES_SNS_TOPIC_ARN) return ok("wrong topic", 400);
  if (m.Type === "SubscriptionConfirmation") {
    const s = new URL(m.SubscribeURL || "http://x");
    if (s.protocol === "https:" && /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(s.hostname)) await fetch(s.toString());
    return ok("confirmed");
  }
  if (m.Type !== "Notification") return ok("ignored");
  const e = JSON.parse(m.Message || "{}"), type = e.eventType || e.notificationType;
  if (type === "Bounce" && e.bounce && e.bounce.bounceType === "Permanent") {
    for (const r of e.bounce.bouncedRecipients || []) await env.DB.prepare("UPDATE people SET email_status = 'bounced' WHERE email = ?1").bind(String(r.emailAddress).toLowerCase()).run();
  }
  if (type === "Complaint" && e.complaint) {
    for (const r of e.complaint.complainedRecipients || []) await env.DB.prepare("UPDATE people SET email_status = 'complained', email_opt_out = 1 WHERE email = ?1").bind(String(r.emailAddress).toLowerCase()).run();
  }
  return ok();
}
