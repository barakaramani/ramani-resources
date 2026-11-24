// Cloudflare Pages Function: POST /api/lead
// Every Ramani form posts here. A person is stored once, matched by email OR phone.
// One time actions (newsletter, community join, a given download ...) are kept once per person.
// Other actions (quote requests and similar) are kept, linked to the same person.
// After each new action the person's MQL score is updated (needs schema_v2.sql).
// Binding needed: D1 database bound as DB (Pages project > Settings > Functions > D1 bindings).

import { KB } from "../../lib/kb.js";
import { makeCore } from "../../lib/core.js";
import { activity } from "../../lib/contact.js";
import { autoEmail, sendToPerson } from "../../lib/email.js";
import { autoSms } from "../../lib/autosms.js";
import { turnstileOk } from "../../lib/turnstile.js";
const core = makeCore(KB);

const ONCE = { tool_lead:1, newsletter:1, community_join:1, registration:1, trip_alerts:1, rate_alert:1,
  freedays_alert:1, partner_review:1, dataroom_request:1, download:"item", download_notify:"item",
  academy_certificate:"item", academy_enroll:"item", importer_survey:1, report_notify:1, meetup_rsvp:"item", meetup_interest:"item" };
const THIRD = { agent_referral:["client_phone"], bank_referral:["phone"] };
const ALLOWED = new Set([...Object.keys(ONCE), ...Object.keys(THIRD), "quote_request", "request", "readiness_score", "finance_interest", "import_plan", "invoice_generator", "webinar_topic", "callback_request", "uliza_question", "repay_reminder", "demurrage_alert", "season_alert"]);

function phone(p){
  p = String(p || "").replace(/[^\d+]/g, ""); if (p[0] === "+") p = p.slice(1); if (p.startsWith("00")) p = p.slice(2);
  if (/^0[67]\d{8}$/.test(p)) p = "255" + p.slice(1); else if (/^[67]\d{8}$/.test(p)) p = "255" + p;
  return /^\d{9,15}$/.test(p) ? "+" + p : null;
}
function email(e){ e = String(e || "").trim().toLowerCase(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 200 ? e : null; }
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const id = (p) => p + crypto.randomUUID().replace(/-/g, "").slice(0, 16);

export async function onRequestPost({ request, env, waitUntil }) {
  let body;
  try { const t = await request.text(); if (t.length > 20000) return json({ ok:false, error:"too_large" }, 413); body = JSON.parse(t); }
  catch { return json({ ok:false, error:"bad_json" }, 400); }
  const type = String(body.type || ""), d = body.data && typeof body.data === "object" ? body.data : {};
  if (!ALLOWED.has(type)) return json({ ok:false, error:"unknown_type" }, 400);
  // Bot check (Cloudflare Turnstile) once TURNSTILE_SECRET is set: stops fake sign ups and SMS pumping.
  if (!(await turnstileOk(request, env, body.turnstile))) return json({ ok:false, error:"bot_check_failed" }, 403);

  const third = !!THIRD[type];
  const em = third ? null : email(d.email);
  const ph = third ? phone(THIRD[type].map(f => d[f]).find(Boolean)) : phone(d.phone || d.whatsapp);
  if (!em && !ph) return json({ ok:false, error:"no_contact" }, 400);
  const name = String((third ? (d.client || d.customer) : d.name) || "").slice(0, 120) || null;
  const now = new Date().toISOString(), page = String(body.page || "").slice(0, 120);

  // 1. Find the person by email and by phone. If the email and the phone belong to two
  //    records (someone first gave only a phone, later only an email), merge them into one.
  const byEmail = em ? await env.DB.prepare("SELECT id FROM people WHERE email = ?1").bind(em).first() : null;
  const byPhone = ph ? await env.DB.prepare("SELECT id FROM people WHERE phone = ?1").bind(ph).first() : null;
  let pid = (byEmail || byPhone || {}).id, status = "existing";
  if (byEmail && byPhone && byEmail.id !== byPhone.id) {
    const keep = byEmail.id, drop = byPhone.id;
    await env.DB.batch([
      env.DB.prepare("UPDATE OR IGNORE submissions SET person_id = ?1 WHERE person_id = ?2").bind(keep, drop),
      env.DB.prepare("DELETE FROM submissions WHERE person_id = ?1").bind(drop),   // repeats of actions the kept record already has
      env.DB.prepare("UPDATE people SET first_seen = MIN(first_seen, (SELECT first_seen FROM people WHERE id = ?2)), referred = MAX(referred, (SELECT referred FROM people WHERE id = ?2)) WHERE id = ?1").bind(keep, drop),
      env.DB.prepare("DELETE FROM people WHERE id = ?1").bind(drop),
    ]);
  }
  if (!pid) {
    pid = id("p_");
    const r = await env.DB.prepare("INSERT OR IGNORE INTO people (id, name, email, phone, referred, first_type, first_page, first_seen, last_seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)")
      .bind(pid, name, em, ph, third ? 1 : 0, type, page, now).run();
    if (r.meta.changes) status = "new";
    else { // two requests raced for the same person
      const again = await env.DB.prepare("SELECT id FROM people WHERE (email = ?1 AND ?1 IS NOT NULL) OR (phone = ?2 AND ?2 IS NOT NULL) LIMIT 1").bind(em, ph).first();
      if (!again) return json({ ok:false, error:"store_failed" }, 500);
      pid = again.id;
    }
  }

  // 2. Fill in details we did not have yet and update last seen.
  await env.DB.prepare("UPDATE people SET name = COALESCE(name, ?2), email = COALESCE(email, ?3), phone = COALESCE(phone, ?4), last_seen = ?5 WHERE id = ?1")
    .bind(pid, name, em, ph, now).run();
  const person = { id: pid };

  // 3. Store the action. A repeat of a one time action is ignored by the unique index.
  const once = third ? "1" : ONCE[type];
  const action = once ? (once === "item" ? `${type}:${String(d.item || "").slice(0, 60)}` : type) : null;
  const r = await env.DB.prepare("INSERT OR IGNORE INTO submissions (id, person_id, type, action_key, page, received_at, data) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
    .bind(id("s_"), person.id, type, action, page, now, JSON.stringify(body).slice(0, 20000)).run();
  const duplicate = r.meta.changes === 0;
  // Email preferences (needs schema_v3.sql): consent, language and region, then the automatic email for this action.
  try {
    const lang = d.language === "sw" ? "sw" : null, region = d.region ? String(d.region).slice(0, 40) : null;
    await env.DB.prepare("UPDATE people SET email_consent = CASE WHEN ?2 = 1 AND email IS NOT NULL THEN 1 ELSE email_consent END, lang = COALESCE(?3, lang), region = COALESCE(?4, region) WHERE id = ?1")
      .bind(person.id, d.marketing_consent === true && !third ? 1 : 0, lang, region).run();
    const mail = !duplicate && !third && autoEmail(env, type, d, lang || "en");
    if (mail) {
      const send = (async () => {
        const p = await env.DB.prepare("SELECT id, name, email, lang, email_consent, email_opt_out, email_status FROM people WHERE id = ?1").bind(person.id).first();
        const res = await sendToPerson(env, p, { ...mail, tags: [["auto", type]] }).catch((e) => ({ error: e.message }));
        if (res.sent || res.error) await env.DB.prepare("INSERT INTO email_sends (id, person_id, kind, status, at, message_id, error) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
          .bind(id("es_"), person.id, mail.kind, res.sent ? "sent" : "failed", new Date().toISOString(), res.message_id || null, res.error || null).run();
      })();
      if (waitUntil) waitUntil(send); else await send;
    }
  } catch {}
  // Confirmation SMS by Ghala for the actions we promise by SMS (alerts, reminders, estimates, call backs). See lib/autosms.js.
  if (!third) {
    const sms = autoSms(env, core, { type, data: d, personId: person.id, duplicate }).catch(() => {});
    if (waitUntil) waitUntil(sms); else await sms;
  }
  if (!duplicate) {
    try {
      const m = core.mqlScore(await activity(env, person.id));
      await env.DB.prepare("UPDATE people SET mql_score = ?2, stage = CASE WHEN stage = 'lead' AND ?3 = 1 THEN 'MQL' ELSE stage END WHERE id = ?1").bind(person.id, m.score, m.mql ? 1 : 0).run();
    } catch {} // before schema_v2.sql is run there is no score column; the lead is still saved
  }

  return json({ ok:true, duplicate, person_id: person.id, person_status: status });
}

export const onRequest = () => json({ ok:false, error:"method_not_allowed" }, 405);
