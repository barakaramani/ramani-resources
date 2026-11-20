// POST /api/sms/test  ·  Ramani team only: sends one SMS through Ghala to check the setup.
// Header x-admin-secret must equal EMAIL_SECRET. Body: {"to":"0712345678","text":"..."}.
// Ghala sandbox numbers (test key only): 0700000001 delivered, 0700000002 failed, 0700000003 invalid.
import { sendSms, smsProvider } from "../../../lib/sms.js";
import { json } from "../../../lib/contact.js";

export async function onRequestPost({ request, env }) {
  if (!env.EMAIL_SECRET || request.headers.get("x-admin-secret") !== env.EMAIL_SECRET) return json({ error: "unauthorised" }, 401);
  let b; try { b = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  const provider = smsProvider(env);
  if (!provider) return json({ error: "not_configured", need: ["GHALA_SMS_KEY", "GHALA_SENDER_ID"] }, 500);
  try {
    const r = await sendSms(env, { to: String(b.to || ""), text: String(b.text || "Ramani: SMS test.").slice(0, 459) });
    return json({ ok: true, sender_id: env.GHALA_SENDER_ID, ...r });
  } catch (e) { return json({ ok: false, provider, error: String(e.message || e).slice(0, 400) }, 502); }
}
export const onRequest = () => json({ error: "method_not_allowed" }, 405);
