// POST /api/uliza  ·  Uliza Ramani, the site assistant. Claude when ANTHROPIC_API_KEY is set, otherwise Cloudflare Workers AI (free tier, binding AI).
// The page sends {messages:[{role,content}], lang, page}. Numbers come from Ramani's own calculator (lib/core.js), not the model.
import { KB } from "../../lib/kb.js";
import { makeCore } from "../../lib/core.js";
import { claudeWithTools } from "../../lib/claude.js";
import { workersAIReady, underDailyCap, factsFor, workersAIAnswer } from "../../lib/workersai.js";

const core = makeCore(KB);
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

const RULES = `You are Uliza Ramani, the assistant on Ramani's free resource site for Tanzanian importers. Ramani is a trade finance company in Dar es Salaam.
Rules:
1. Reply in the language of the user's last message (Kiswahili or English). Keep it short: under 120 words, simple words, short lines.
2. Every number (costs, duty, VAT, days) must come from the plan_import tool. Never invent duty rates, prices, permits, laws or bank fees. If the tools do not cover it, say you are not sure and suggest a licensed clearing agent or a Ramani BDM.
3. Finance: Ramani pays the supplier and the importer repays as they sell, subject to assessment. Never say someone qualifies, will be approved or what rate they will pay. Suggest the readiness score (import-finance-readiness-score.html) or a call with a Ramani BDM.
4. End with one or two links to Ramani pages as markdown links, using urls exactly as the tools return them.
5. Never ask for phone numbers, ID numbers or bank details.
6. Only help with importing, trade, Ramani's tools and running an import business. Politely decline anything else.
7. Do not use dashes. Use plain sentences or short bullet lists.`;

const TOOLS = [
  { name: "plan_import", description: "Works out an import with Ramani's calculator: shipping option, landed cost in TZS, duty band, VAT, deposit, days to the shop, permits and a link to the full plan. Use it for ANY cost question.",
    input_schema: { type: "object", properties: { goods: { type: "string", description: "household, elec, build, textile, food, cosm, med, agri, mach, parts or furn" }, origin: { type: "string", description: "cn, in, ae, tr or eu" }, value_usd: { type: "number" }, region: { type: "string", description: "dar, aru, mwz, mby, dod or oth" } }, required: ["goods", "value_usd"] } },
  { name: "search_resources", description: "Finds Ramani tools, templates, guides and courses for a need. Returns up to 5 with title and url.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "permits_for", description: "Lists the Tanzanian permits and standards Ramani's permit finder shows for a kind of goods.",
    input_schema: { type: "object", properties: { goods: { type: "string" } }, required: ["goods"] } },
  { name: "define_word", description: "Looks up an import word in the Ramani glossary, with English and Kiswahili meanings.",
    input_schema: { type: "object", properties: { word: { type: "string" } }, required: ["word"] } },
];

// Remove phone numbers, emails and long digit runs before anything reaches the model.
const redact = (s) => String(s).replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]").replace(/(\+?\d[\d\s-]{7,}\d)/g, "[number]");

export async function onRequestPost({ request, env }) {
  let body; try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (env.TURNSTILE_SECRET) { // optional bot check
    const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(body.turnstile || ""), remoteip: request.headers.get("cf-connecting-ip") || "" }) }).then((r) => r.json()).catch(() => ({}));
    if (!v.success) return json({ error: "bot_check_failed" }, 403);
  }
  const sw = body.lang === "sw";
  let turns = (Array.isArray(body.messages) ? body.messages : []).slice(-10)
    .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .map((t) => ({ role: t.role, content: redact(t.content).slice(0, 1500) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  // merge repeated roles so the conversation alternates
  turns = turns.reduce((a, t) => { if (a.length && a[a.length - 1].role === t.role) a[a.length - 1].content += "\n" + t.content; else a.push(t); return a; }, []);
  if (!turns.length || turns[turns.length - 1].role !== "user") return json({ error: "no_question" }, 400);

  const run = (name, i) => {
    if (name === "plan_import") return core.plan(i);
    if (name === "search_resources") return core.search(String(i.query || ""), 5).map((r) => ({ title: sw ? r.title_sw : r.title, url: r.url, about: sw ? r.about_sw : r.about }));
    if (name === "permits_for") return { permits: core.permits(String(i.goods || "")).map((p) => ({ agency: p.agency, rule: sw ? p.sw : p.en })), url: "import-permit-finder.html" };
    if (name === "define_word") { const d = core.define(String(i.word || "")); if (!d.length) throw new Error("Not in the glossary"); return d; }
    throw new Error("Unknown tool");
  };
  const question = turns[turns.length - 1].content;
  const qid = "q_" + crypto.randomUUID().slice(0, 18);
  if (env.DB) { // keep the questions: they show what content to make next
    try { await env.DB.prepare("INSERT INTO questions (id, asked_at, page, lang, question) VALUES (?1, ?2, ?3, ?4, ?5)").bind(qid, new Date().toISOString(), String(body.page || "").slice(0, 120), sw ? "sw" : "en", question.slice(0, 1000)).run(); } catch {}
  }
  const clean = (t) => String(t).replace(/[—–]/g, ",");
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_MODEL) { // 1. Claude, when Ramani adds a key
    try {
      const text = await claudeWithTools(env, { system: RULES + "\nSite language: " + (sw ? "Kiswahili" : "English") + ". Page: " + String(body.page || "").slice(0, 80), messages: turns, tools: TOOLS, run });
      if (text) return json({ text: clean(text), by: "claude" });
    } catch {}
  }
  if (workersAIReady(env) && (await underDailyCap(env))) { // 2. Cloudflare Workers AI, free tier
    try {
      const text = await workersAIAnswer(env, { rules: RULES, facts: factsFor(core, question, sw), turns, sw });
      if (text) {
        if (env.DB) { try { await env.DB.prepare("UPDATE questions SET answered_by = 'workers_ai' WHERE id = ?1").bind(qid).run(); } catch {} }
        return json({ text: clean(text), by: "workers_ai" });
      }
    } catch {}
  }
  return json({ error: "brain_unavailable" }, 503); // 3. the page answers from Ramani's tools on its own
}
