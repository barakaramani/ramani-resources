// Automatic SMS from the resource site (Ghala). When a visitor signs up for something we promised by SMS,
// they get one confirmation SMS straight away. Rules:
//  - only with a phone number, only once per action (repeats are skipped), never to anyone who replied STOP;
//  - marketing style messages only when the visitor ticked consent; service replies (a BDM call back they asked for) always;
//  - every SMS is logged in the calls table so delivery reports from Ghala can update it.
// Messages are in Kiswahili, short (one SMS where possible) and end with how to stop.
import { sendSms, smsProvider } from "./sms.js";
import { id } from "./contact.js";
import { liveRates } from "./fx.js";

const STOP_SW = " Jibu STOP kusitisha.";
const GOODS_SW = { household: "bidhaa za nyumbani", elec: "vifaa vya umeme", build: "vifaa vya ujenzi", textile: "nguo", food: "chakula", cosm: "vipodozi", med: "dawa", agri: "pembejeo za kilimo", mach: "mashine", parts: "vipuri", furn: "samani" };
const SERVICE = new Set(["callback_request", "finance_interest"]); // the visitor asked us to contact them
const tzs = (n) => "TZS " + Math.round(Number(n) || 0).toLocaleString("en-US");
const first = (n) => String(n || "").trim().split(/\s+/)[0].slice(0, 20);
const dmy = (iso) => { const d = new Date(iso); return isNaN(d) ? String(iso || "") : `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`; };

// Returns the SMS text for an action, or null when this action does not get an SMS.
export async function autoSmsText(env, core, type, d) {
  const t = await textFor(env, core, type, d);
  return t ? t.replace(/^Ramani: ([a-z])/, (m, c) => "Ramani: " + c.toUpperCase()) : t;
}
async function textFor(env, core, type, d) {
  const hi = first(d.name) ? `Habari ${first(d.name)}, ` : "";
  switch (type) {
    case "rate_alert":
      return `Ramani: ${hi}umejiunga na viwango vya kubadilisha fedha (${[].concat(d.currencies || []).slice(0, 4).join(", ") || "USD"}) kila wiki kwa SMS.` + STOP_SW;
    case "trip_alerts":
      return `Ramani: ${hi}umejiunga na taarifa za safari ya biashara ${d.country ? "kwenda " + d.country : ""}. Tutakutumia habari muhimu kabla ya safari.` + STOP_SW;
    case "freedays_alert":
      return `Ramani: Tutakukumbusha siku ${Number(d.days_before) || 2} kabla siku za bure za makontena yako kuisha bandarini.` + STOP_SW;
    case "demurrage_alert":
      return `Ramani: Siku za bure za kontena lako zinaisha ${dmy(d.free_days_end)}. Tutakukumbusha ${[].concat(d.alert_dates || []).map(dmy).join(" na ")}.` + STOP_SW;
    case "repay_reminder":
      return `Ramani: Tutakukumbusha kila ${d.day || "wiki"} kutenga ${tzs(d.weekly_set_aside_tzs)} kwa marejesho, kwa wiki ${Number(d.weeks) || ""}.`.replace(" kwa wiki .", ".") + STOP_SW;
    case "season_alert":
      return `Ramani: Tutakukumbusha siku ${Number(d.remind_days_before) || 7} kabla ya tarehe ya kuagiza mzigo wa msimu.` + STOP_SW;
    case "import_plan": {
      if (!d.goods || !d.value_usd) return null;
      try { const fx = await liveRates(); globalThis.window = globalThis.window || {}; globalThis.window.RAMANI_LIVE = { usd: fx.usd }; } catch {}
      let r; try { r = core.plan({ goods: d.goods, origin: d.origin || "cn", value_usd: d.value_usd, region: d.region || "dar" }); } catch { return null; }
      const site = (env.SITE_URL || "https://ramani-resources.pages.dev").replace(/\/$/, "");
      return `Ramani: ${hi}makadirio ya mzigo wako (${GOODS_SW[r.goods] || "bidhaa"}, USD ${Number(r.value_usd).toLocaleString("en-US")}): ${tzs(r.landed_cost_tzs_excluding_vat_claimed_back)} hadi dukani, siku ${r.days_from_order_to_shop}. Mpango kamili: ${site}/${r.url}` + STOP_SW;
    }
    case "callback_request":
      return `Ramani: ${hi}tumepokea ombi lako. BDM wa Ramani atakupigia ndani ya siku moja ya kazi.`;
    case "finance_interest":
      return `Ramani: ${hi}tumepokea ombi lako kuhusu kumlipa msambazaji. BDM wa Ramani atawasiliana nawe ndani ya siku moja ya kazi. Ufadhili unategemea tathmini.`;
    default:
      return null;
  }
}

// Sends the confirmation SMS for one lead action. Safe to call for every action: it decides itself whether to send.
export async function autoSms(env, core, { type, data: d, personId, duplicate }) {
  if (duplicate || !personId || !smsProvider(env) || String(env.AUTO_SMS || "on").toLowerCase() === "off") return { skipped: "off" };
  if (!SERVICE.has(type) && d.marketing_consent !== true) return { skipped: "no_consent" };
  const p = await env.DB.prepare("SELECT phone, opt_out FROM people WHERE id = ?1").bind(personId).first();
  if (!p || !p.phone) return { skipped: "no_phone" };
  if (p.opt_out) return { skipped: "opted_out" };
  const text = await autoSmsText(env, core, type, d);
  if (!text) return { skipped: "no_template" };
  const cid = id("c_"), now = new Date().toISOString();
  let res = null, err = null;
  try { res = await sendSms(env, { to: p.phone, text, idempotencyKey: "auto_" + type + "_" + personId }); } catch (e) { err = String(e.message || e).slice(0, 300); }
  await env.DB.prepare("INSERT INTO calls (id, person_id, channel, direction, at, transcript, outcome, sms_status, sms_message_id, sms_provider, raw) VALUES (?1, ?2, 'sms', 'outbound', ?3, ?4, ?5, ?6, ?7, ?8, ?9)")
    .bind(cid, personId, now, text, "auto_" + type, err ? "failed" : "sent", (res && res.id) || null, (res && res.provider) || null, err ? JSON.stringify({ error: err }) : null).run().catch(() => {});
  return err ? { error: err } : { sent: true, id: res && res.id };
}
