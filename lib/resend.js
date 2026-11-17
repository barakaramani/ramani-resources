// Send email through Resend (resend.com). Env: RESEND_API_KEY (secret), EMAIL_FROM (for example "Ramani <news@news.ramani.io>"),
// optional EMAIL_REPLY_TO. Bounces and spam complaints come back to functions/api/email/resend-events.js (RESEND_WEBHOOK_SECRET).
const API = "https://api.resend.com";

export function resendReady(env) { return !!(env.RESEND_API_KEY && (env.EMAIL_FROM || env.RESEND_FROM)); }

// Resend tags allow only letters, digits, underscore and dash, up to 256 characters.
const tagSafe = (v) => String(v).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);

export async function resendSend(env, { to, subject, html, text, headers = [], tags = [], idempotencyKey }) {
  const payload = { from: env.EMAIL_FROM || env.RESEND_FROM, to: [to], subject, html };
  if (text) payload.text = text;
  if (env.EMAIL_REPLY_TO) payload.reply_to = env.EMAIL_REPLY_TO;
  if (headers.length) payload.headers = Object.fromEntries(headers);
  if (tags.length) payload.tags = tags.map(([name, value]) => ({ name: tagSafe(name), value: tagSafe(value) }));
  const h = { "content-type": "application/json", authorization: "Bearer " + env.RESEND_API_KEY };
  if (idempotencyKey) h["idempotency-key"] = String(idempotencyKey).slice(0, 256); // a retried send is not sent twice
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(API + "/emails", { method: "POST", headers: h, body: JSON.stringify(payload) });
    const t = await r.text();
    if (r.ok) return JSON.parse(t).id;
    // 429 is either the 10 per second rate limit (wait and retry) or a daily or monthly quota (stop).
    if (r.status === 429 && attempt < 2 && !/quota/i.test(t)) { await new Promise((ok) => setTimeout(ok, 1100)); continue; }
    throw new Error("Resend " + r.status + ": " + t.slice(0, 300));
  }
}

// Checks a Resend webhook. Resend signs with Svix: HMAC SHA256 over "id.timestamp.body", key = base64 part of the whsec_ secret.
export async function verifyResendWebhook(env, headers, body) {
  const secret = env.RESEND_WEBHOOK_SECRET, id = headers.get("svix-id"), ts = headers.get("svix-timestamp"), sigs = headers.get("svix-signature");
  if (!secret || !id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // older than 5 minutes: possible replay
  const raw = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  const expected = btoa(String.fromCharCode(...mac));
  return sigs.split(" ").some((s) => { const [v, sig] = s.split(","); return v === "v1" && sig && sig.length === expected.length && timingSafe(sig, expected); });
}
function timingSafe(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
