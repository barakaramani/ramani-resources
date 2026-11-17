// One SMS layer for Ramani. Ghala sends SMS by default; SemaCall is the fallback.
// Set SMS_PROVIDER to "ghala" or "semacall" to force one. Replies from customers, from either provider, go through handleInboundSms.
import { ghalaReady, ghalaSendSms } from "./ghala.js";
import { sendSms as semacallSendSms } from "./semacall.js";
import { claudeJSON } from "./claude.js";
import { id, phone } from "./contact.js";

export function smsProvider(env) {
  const want = String(env.SMS_PROVIDER || "").toLowerCase();
  if (want === "semacall") return env.SEMACALL_API_BASE && env.SEMACALL_API_KEY ? "semacall" : null;
  if (want === "ghala") return ghalaReady(env) ? "ghala" : null;
  return ghalaReady(env) ? "ghala" : env.SEMACALL_API_BASE && env.SEMACALL_API_KEY ? "semacall" : null;
}

// Sends one SMS that a BDM approved. Never called without a human approval.
export async function sendSms(env, { to, text, idempotencyKey }) {
  const provider = smsProvider(env);
  if (!provider) throw new Error("No SMS provider: set GHALA_SMS_KEY and GHALA_SENDER_ID");
  if (provider === "ghala") return { provider, ...(await ghalaSendSms(env, { to, text, idempotencyKey })) };
  return { provider, result: await semacallSendSms(env, { to, text }) };
}

const SYSTEM = "You update Ramani's CRM from BDM calls and customer SMS. Ramani pays importers' suppliers and they repay as they sell, subject to assessment. Never promise approval or rates in any message. No dashes.";
export const STOP = /^\s*(stop|acha|sitaki|unsubscribe|ondoa)\b/i;

// A customer texted Ramani. STOP, ACHA or SITAKI opts them out of marketing SMS; anything else gets a reply draft for a BDM to approve.
export async function handleInboundSms(env, { phone: from, text, at, external_id, raw, source }) {
  const ph = phone(from), now = new Date().toISOString();
  let person = ph ? await env.DB.prepare("SELECT id, name, stage FROM people WHERE phone = ?1").bind(ph).first() : null;
  if (!person && ph) {
    const pid = id("p_");
    await env.DB.prepare("INSERT OR IGNORE INTO people (id, phone, first_type, first_page, first_seen, last_seen) VALUES (?1, ?2, 'sms.received', ?3, ?4, ?4)").bind(pid, ph, source || "sms", now).run();
    person = await env.DB.prepare("SELECT id, name, stage FROM people WHERE phone = ?1").bind(ph).first() || { id: pid, name: "", stage: "lead" };
  }
  if (external_id) { // providers may send the same event twice
    const seen = await env.DB.prepare("SELECT id FROM calls WHERE external_id = ?1 AND channel = 'sms'").bind(external_id).first();
    if (seen) return { outcome: "duplicate" };
  }
  let out = { outcome: "question", reply: "" };
  if (STOP.test(text)) { out.outcome = "stop"; if (person) await env.DB.prepare("UPDATE people SET opt_out = 1 WHERE id = ?1").bind(person.id).run(); }
  else {
    try {
      const j = await claudeJSON(env, { system: SYSTEM, smart: false, maxTokens: 300, prompt:
        'A customer sent Ramani this SMS. Return JSON only: {"outcome":"interested|question|not_interested|other","reply_sw":"short friendly Kiswahili reply draft for a BDM to approve, under 300 characters, signed Ramani"}\nSMS: ' + String(text).slice(0, 1000) });
      out = { outcome: j.outcome, reply: j.reply_sw };
    } catch {}
  }
  await env.DB.prepare("INSERT INTO calls (id, person_id, channel, direction, at, transcript, outcome, sms_draft, sms_status, external_id, raw) VALUES (?1, ?2, 'sms', 'inbound', ?3, ?4, ?5, ?6, ?7, ?8, ?9)")
    .bind(id("c_"), person && person.id, at || now, String(text).slice(0, 2000), out.outcome, out.reply || null, out.reply ? "draft" : "skipped", external_id || null, JSON.stringify(raw || {}).slice(0, 8000)).run();
  return { outcome: out.outcome };
}
