// Ghala SMS adapter (ghala.io). Ghala's public docs only show one SMS sample, so the points marked "confirm" must be checked
// with Ghala (info@ghala.io) or in the Ghala dashboard. Only this file changes when we get their full SMS docs.
// Env: GHALA_SMS_KEY (secret), GHALA_SENDER_ID (the approved sender name, for example RAMANI),
//      optional GHALA_SMS_BASE (default https://sms-api.ghala.io), GHALA_PHONE_FORMAT ("local" 0712345678, or "intl" 255712345678),
//      GHALA_WEBHOOK_SECRET (signing secret for delivery reports and replies).

export function ghalaReady(env) { return !!(env.GHALA_SMS_KEY && env.GHALA_SENDER_ID); }

// We store phones as +255712345678. Ghala's sample uses 0712345678; switch with GHALA_PHONE_FORMAT once confirmed.
export function ghalaPhone(env, p) {
  const d = String(p || "").replace(/\D/g, "");
  if (String(env.GHALA_PHONE_FORMAT || "local").toLowerCase() === "intl") return d;
  return d.startsWith("255") && d.length === 12 ? "0" + d.slice(3) : d;
}

export async function ghalaSendSms(env, { to, text, idempotencyKey }) {
  if (!ghalaReady(env)) throw new Error("Ghala is not configured: set GHALA_SMS_KEY and GHALA_SENDER_ID");
  const h = { "content-type": "application/json", authorization: "Bearer " + env.GHALA_SMS_KEY };
  if (idempotencyKey) h["idempotency-key"] = String(idempotencyKey).slice(0, 100); // confirm Ghala honours this for SMS
  const r = await fetch((env.GHALA_SMS_BASE || "https://sms-api.ghala.io").replace(/\/$/, "") + "/v1/messages", {
    method: "POST", headers: h,
    body: JSON.stringify({ to: [ghalaPhone(env, to)], body: text, sender_id: env.GHALA_SENDER_ID }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error("Ghala " + r.status + ": " + t.slice(0, 300));
  let j = {}; try { j = JSON.parse(t); } catch {}
  const first = (Array.isArray(j.data) ? j.data[0] : j.data) || (Array.isArray(j.messages) ? j.messages[0] : null) || j; // confirm response shape
  return { id: first.id || first.message_id || null, status: first.status || null };
}

// Ghala signs webhooks with X-Ghala-Signature: sha256=hex(HMAC_SHA256(secret, timestamp + "." + raw body)) and X-Ghala-Timestamp.
// This is Ghala's documented scheme for WhatsApp events; their site says every channel arrives signed the same way.
export async function verifyGhalaWebhook(env, headers, body) {
  const secret = env.GHALA_WEBHOOK_SECRET, sig = headers.get("x-ghala-signature") || "", ts = headers.get("x-ghala-timestamp");
  if (!secret || !ts || !sig.startsWith("sha256=")) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ts + "." + body)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join(""), got = sig.slice(7).toLowerCase();
  if (got.length !== expected.length) return false;
  let d = 0; for (let i = 0; i < got.length; i++) d |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return d === 0;
}

// Turns a Ghala event into one shape: a reply from a customer, or a delivery status. Accepts Ghala's own format
// and the WhatsApp Cloud API style format, because the docs show both. Extend once we see real SMS payloads.
export function normaliseGhala(eventName, p) {
  const v = (p && p.value) || (p && p.entry && p.entry[0] && p.entry[0].changes && p.entry[0].changes[0] && p.entry[0].changes[0].value) || {};
  const d = (p && (p.data || p.message)) || p || {};
  const inMsg = (v.messages && v.messages[0]) || null;
  const st = (v.statuses && v.statuses[0]) || null;
  const name = String(eventName || p.event || p.type || "").toLowerCase();
  if (inMsg || /received|inbound|reply|incoming/.test(name)) {
    const m = inMsg || d;
    return { type: "sms.received", phone: m.from || m.sender || m.phone || "", text: String((m.text && (m.text.body || m.text)) || m.body || m.message || ""),
      external_id: m.id || m.message_id || null, at: m.timestamp ? new Date(Number(m.timestamp) * 1000 || m.timestamp).toISOString() : new Date().toISOString() };
  }
  if (st || /status|deliver|sent|fail/.test(name)) {
    const s = st || d;
    return { type: "sms.status", external_id: s.id || s.message_id || null, status: String(s.status || "").toUpperCase(), phone: s.recipient_id || s.to || "" };
  }
  return { type: name || "unknown" };
}
