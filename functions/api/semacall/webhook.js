// POST /api/semacall/webhook  ·  SemaCall tells us about finished calls and incoming SMS.
// Set the same secret in SemaCall and in env.SEMACALL_WEBHOOK_SECRET; SemaCall sends it as the x-ramani-secret header (or ?secret=).
import { claudeJSON } from "../../../lib/claude.js";
import { normalise } from "../../../lib/semacall.js";
import { json, id, phone } from "../../../lib/contact.js";
import { handleInboundSms } from "../../../lib/sms.js";

const SYSTEM = "You update Ramani's CRM from BDM calls and customer SMS. Ramani pays importers' suppliers and they repay as they sell, subject to assessment. Never promise approval or rates in any message. No dashes.";

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const secret = request.headers.get("x-ramani-secret") || url.searchParams.get("secret");
  if (!env.SEMACALL_WEBHOOK_SECRET || secret !== env.SEMACALL_WEBHOOK_SECRET) return json({ error: "unauthorised" }, 401);
  const raw = await request.json().catch(() => null); if (!raw) return json({ error: "bad_json" }, 400);
  const e = normalise(raw), ph = phone(e.phone), now = new Date().toISOString();

  // Find the person by phone, or add them (someone called Ramani first).
  let person = ph ? await env.DB.prepare("SELECT id, name, stage FROM people WHERE phone = ?1").bind(ph).first() : null;
  if (!person && ph) {
    const pid = id("p_");
    await env.DB.prepare("INSERT OR IGNORE INTO people (id, phone, first_type, first_page, first_seen, last_seen) VALUES (?1, ?2, ?3, 'semacall', ?4, ?4)").bind(pid, ph, e.type, now).run();
    person = { id: pid, name: "", stage: "lead" };
  }
  const first = String((person && person.name) || "").split(" ")[0];

  if (e.type === "sms.received") { // same handling as Ghala replies
    const r = await handleInboundSms(env, { phone: e.phone, text: e.text, at: e.at, external_id: e.external_id, raw, source: "semacall" });
    return json({ ok: true, outcome: r.outcome });
  }

  if (e.type === "call.completed") {
    const words = (e.transcript || e.notes || "").trim();
    let s = { summary: null, outcome: e.disposition || null, stage: null, next_step: null, next_date: null, objections: [], sms_sw: null };
    if (words) {
      try {
        const j = await claudeJSON(env, { system: SYSTEM, smart: true, prompt:
          'Turn this Ramani call into a CRM update. Return JSON only: {"summary":"2 sentences","outcome":"interested|call_back|not_now|not_a_fit|no_answer","stage":"MQL|SQL|application|lost","next_step":"short","next_date":"YYYY-MM-DD or empty","objections":["..."],"sms_sw":"friendly Kiswahili follow up SMS from the BDM, under 300 characters, signed Ramani"}\n' +
          "Today is " + now.slice(0, 10) + ". Customer first name: " + first + ". Call length: " + e.duration + " seconds.\nTranscript or notes:\n" + words.slice(0, 12000) });
        s = Object.assign(s, j);
      } catch {}
    }
    await env.DB.prepare("INSERT INTO calls (id, person_id, channel, direction, bdm, at, duration, recording_url, transcript, summary, outcome, next_step, next_date, objections, sms_draft, sms_status, external_id, raw) VALUES (?1, ?2, 'call', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)")
      .bind(id("c_"), person && person.id, e.direction || null, e.bdm || null, e.at, e.duration, e.recording_url || null, words.slice(0, 20000) || null, s.summary, s.outcome, s.next_step, s.next_date || null, JSON.stringify(s.objections || []), s.sms_sw, s.sms_sw ? "draft" : "skipped", e.external_id, JSON.stringify(raw).slice(0, 8000)).run();
    if (person && s.stage && ["SQL", "application", "lost", "MQL"].includes(s.stage)) await env.DB.prepare("UPDATE people SET stage = ?2, owner_bdm = COALESCE(owner_bdm, ?3), last_seen = ?4 WHERE id = ?1").bind(person.id, s.stage, e.bdm || null, now).run();
    return json({ ok: true, summarised: !!words, needs_transcript: !words && !!e.recording_url });
  }
  return json({ ok: true, ignored: e.type });
}
