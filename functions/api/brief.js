// GET /api/brief?person=ID  ·  Staff only (Cloudflare Access). MQL score plus an AI call brief for the BDM.
import { KB } from "../../lib/kb.js";
import { makeCore } from "../../lib/core.js";
import { claude } from "../../lib/claude.js";
import { json, staff, activity } from "../../lib/contact.js";

const core = makeCore(KB);
export const SYSTEM = "You prepare short call briefs for Ramani BDMs (sales) in Dar es Salaam. Ramani pays importers' suppliers and they repay as they sell, subject to assessment. Never promise approval or rates. No dashes.";

export async function makeBrief(env, personId) {
  const person = await env.DB.prepare("SELECT id, name, phone, email, stage, owner_bdm, referred FROM people WHERE id = ?1").bind(personId).first();
  if (!person) return null;
  const acts = await activity(env, personId);
  const m = core.mqlScore(acts);
  await env.DB.prepare("UPDATE people SET mql_score = ?2, stage = CASE WHEN stage = 'lead' AND ?3 = 1 THEN 'MQL' ELSE stage END WHERE id = ?1").bind(personId, m.score, m.mql ? 1 : 0).run();
  const calls = await env.DB.prepare("SELECT at, summary, outcome, next_step FROM calls WHERE person_id = ?1 ORDER BY at DESC LIMIT 3").bind(personId).all();
  // No phone or email goes to the model: only the first name and what they did.
  const clean = acts.map((a) => { const d = {}; for (const k in a.data) if (!/name|phone|whatsapp|email/.test(k)) d[k] = a.data[k]; return { type: a.type, at: a.at.slice(0, 10), data: d }; });
  let brief = "";
  try {
    const res = await claude(env, { system: SYSTEM, smart: true, maxTokens: 500, messages: [{ role: "user", content:
      "Write a call brief in English with an opening line in Kiswahili. Sections: Who they are; What they want; Why they are an MQL (score " + m.score + "); 3 questions to ask; Opening line (Kiswahili). Under 150 words.\n" +
      "First name: " + String(person.name || "").split(" ")[0] + "\nStage: " + person.stage + "\nRecent calls: " + JSON.stringify(calls.results || []) + "\nActivity: " + JSON.stringify(clean).slice(0, 8000) }] });
    brief = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  } catch (e) { brief = "Why MQL: " + m.reasons.join(", "); }
  return { person, score: m.score, mql: m.mql, reasons: m.reasons, brief };
}

export async function onRequestGet({ request, env }) {
  if (!(await staff(request, env))) return json({ error: "staff_only" }, 401);
  const pid = new URL(request.url).searchParams.get("person");
  const b = pid && await makeBrief(env, pid);
  return b ? json(b) : json({ error: "not_found" }, 404);
}
