// POST /api/uliza  ·  Uliza Ramani, the site assistant. Claude when ANTHROPIC_API_KEY is set, otherwise Cloudflare Workers AI (free tier, binding AI).
// The page sends {messages:[{role,content}], lang, page}. Numbers come from Ramani's own calculator (lib/core.js), not the model.
import { turnstileOk } from "../../lib/turnstile.js";
import { KB } from "../../lib/kb.js";
import { makeCore } from "../../lib/core.js";
import { claudeWithTools } from "../../lib/claude.js";
import { workersAIReady, underDailyCap, factsFor, workersAIAnswer } from "../../lib/workersai.js";
import { liveRates } from "../../lib/fx.js";

const core = makeCore(KB);

// Page titles for links, so answers say "Landed cost calculator" and not "landed-cost-calculator.html".
const TITLES = (() => { const m = {}; (KB.res || []).forEach((r) => { if (r && r[1]) m[String(r[1]).split(/[?#]/)[0]] = [r[5], r[6]]; }); return m; })();
const EXTRA = { "import-plan-generator.html": ["Your import plan", "Mpango wako wa uagizaji"], "glossary.html": ["Importer glossary", "Kamusi ya mwagizaji"], "import-permit-finder.html": ["Permit finder", "Kitafuta vibali"], "resources.html": ["Resource library", "Maktaba ya rasilimali"] };
function titleFor(url, sw) {
  const base = String(url).split(/[?#]/)[0], t = TITLES[base] || EXTRA[base];
  if (t) return (sw && t[1]) || t[0];
  const w = base.replace(/\.html$/i, "").replace(/[-_]+/g, " ").trim();
  return w ? w[0].toUpperCase() + w.slice(1) : null;
}
export function fixLinks(text, sw) {
  let out = String(text).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label, url) => {
    const base = String(url).split(/[?#]/)[0], known = TITLES[base] || EXTRA[base];
    const fileLike = /\.html\b/i.test(label) || /^https?:/i.test(label) || label.trim() === url;
    const t = known || fileLike ? titleFor(url, sw) : null; // known pages always use their real title, in the reply's language
    return t ? `[${t}](${url})` : all;
  });
  // a bare file name in the text becomes a proper link
  out = out.replace(/(^|[\s:])((?:[a-z0-9]+-)*[a-z0-9]+\.html(?:\?[^\s)\]]*)?)(?=[\s.,;!?]|$)/gim, (all, pre, url) => { const t = titleFor(url, sw); return t ? `${pre}[${t}](${url})` : all; });
  // drop a line that only repeats a link already given
  const seen = new Set();
  out = out.split("\n").filter((line) => {
    const urls = [...line.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
    const bare = line.replace(/\[[^\]]*\]\([^)]*\)/g, "").replace(/[\s*\-•·.,]/g, "");
    const dup = urls.length && !bare && urls.every((u) => seen.has(u));
    urls.forEach((u) => seen.add(u));
    return !dup;
  }).join("\n");
  return out;
}

// The plan's numbers are written here from Ramani's calculator, so the model can never change them.
const GN = { household: ["household goods", "bidhaa za nyumbani"], elec: ["electronics", "vifaa vya umeme"], build: ["building materials", "vifaa vya ujenzi"], textile: ["clothes and textiles", "nguo"], food: ["food", "chakula"], cosm: ["cosmetics", "vipodozi"], med: ["medicines", "dawa"], agri: ["farm inputs", "pembejeo za kilimo"], mach: ["machinery", "mashine"], parts: ["spare parts", "vipuri"], furn: ["furniture", "samani"] };
const ON = { cn: "China", in: "India", ae: "Dubai", tr: "Turkey", eu: "Europe" };
const RN = { dar: "Dar es Salaam", aru: "Arusha", mwz: "Mwanza", mby: "Mbeya", dod: "Dodoma", oth: "upcountry" };
const tz = (n) => "TZS " + Math.round(n).toLocaleString("en-US");
export function planBlock(r, sw) {
  const g = (GN[r.goods] || GN.household)[sw ? 1 : 0], o = ON[r.origin] || r.origin, to = RN[r.region] || r.region, usd = "USD " + Number(r.value_usd).toLocaleString("en-US");
  return sw ? [
    `Makadirio: ${g}, thamani ${usd}, kutoka ${o} hadi ${to}:`,
    `- Usafirishaji: ${r.shipping}, takriban m³ ${r.cubic_metres}`,
    `- Ushuru (${r.duty_band_percent}%): ${tz(r.duty_tzs)}`,
    `- VAT ya uagizaji (18%): ${tz(r.import_vat_tzs)}`,
    `- Gharama hadi dukani: **${tz(r.landed_cost_tzs_excluding_vat_claimed_back)}** (ukidai VAT)`,
    `- Malipo ya awali 30%: ${tz(r.deposit_30_percent_tzs)}`,
    `- Takriban siku ${r.days_from_order_to_shop} hadi dukani`,
    `- Vibali vya kuangalia: ${(r.permits || []).join(", ")}`,
    `Kiwango cha leo: 1 USD = ${r.usd_tzs_rate} TZS. Benki, maduka ya fedha na TRA vinaweza kutofautiana.`,
  ].join("\n") : [
    `Estimate for ${usd} of ${g} from ${o} to ${to}:`,
    `- Shipping: ${r.shipping}, about ${r.cubic_metres} m³`,
    `- Duty (${r.duty_band_percent}%): ${tz(r.duty_tzs)}`,
    `- Import VAT (18%): ${tz(r.import_vat_tzs)}`,
    `- Landed cost: **${tz(r.landed_cost_tzs_excluding_vat_claimed_back)}** (if you claim back import VAT)`,
    `- 30% deposit: ${tz(r.deposit_30_percent_tzs)}`,
    `- About ${r.days_from_order_to_shop} days to your shop`,
    `- Permits to check: ${(r.permits || []).join(", ")}`,
    `Today's rate: 1 USD = ${r.usd_tzs_rate} TZS. Bank, bureau and TRA rates may differ.`,
  ].join("\n");
}

// What the chat already established: a plan from an earlier message, carried into a follow up question.
function pickFrom(map, text) {
  const w = " " + String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(Boolean).join(" ") + " ";
  let best = null, n = 0;
  Object.keys(map || {}).forEach((k) => { let c = 0; map[k].split(" ").forEach((x) => { if (w.indexOf(" " + x + " ") >= 0) c++; }); if (c > n) { n = c; best = k; } });
  return best;
}
const COST = /cost|gharama|bei|how much|kiasi|landed|duty|ushuru|vat|deposit|malipo|days|siku|instead|badala|what about|je kwa|na kwa/i;
const PERMIT = /permit|kibali|vibali|tbs|tmda|tcra|standard|certificate|cheti/i;
export function chatContext(turns) {
  const users = turns.filter((t) => t.role === "user").map((t) => t.content), q = users[users.length - 1] || "";
  const ctx = {};
  let prior = null;
  for (let i = users.length - 2; i >= 0 && !prior; i--) { try { prior = core.parsePlan(users[i]); } catch {} }
  let now = null; try { now = core.parsePlan(q); } catch {}
  if (!now && prior) {
    const g = pickFrom(KB.goods, q), o = pickFrom(KB.orig, q), r = pickFrom(KB.reg, q), v = core.money(q);
    if (g || o || r || v || COST.test(q)) ctx.plan = { goods: g || prior.goods, origin: o || prior.origin, region: r || prior.region, value_usd: v || prior.value_usd };
  }
  if (!core.goods(q) && PERMIT.test(q)) ctx.goods = (prior && prior.goods) || null;
  return ctx;
}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

const RULES = `You are Uliza Ramani, the assistant on Ramani's free resource site for Tanzanian importers. Ramani is a trade finance company in Dar es Salaam.
Rules:
1. Reply in the language of the user's last message (Kiswahili or English). Keep it short: under 100 words, simple words, short lines. Start with the answer; do not repeat the question.
2. Every number (costs, duty, VAT, days) must come from the plan_import tool. Never invent duty rates, prices, permits, laws or bank fees. If the tools do not cover it, say you are not sure and suggest a licensed clearing agent or a Ramani BDM.
3. Finance: Ramani pays the supplier and the importer repays as they sell, subject to assessment. Never say someone qualifies, will be approved or what rate they will pay. Suggest the readiness score (import-finance-readiness-score.html) or a call with a Ramani BDM.
4. End with one or two links to Ramani pages as markdown links, using urls exactly as the tools return them. The link text is the page title, never a file name.
5. Never ask for phone numbers, ID numbers or bank details.
6. Only help with importing, trade, Ramani's tools and running an import business. Politely decline anything else.
7. Do not use dashes. Use plain sentences or short bullet lists. Put each number on its own bullet.
8. Kiswahili: write simple, everyday Tanzanian Kiswahili as traders in Kariakoo speak it, not a word for word translation. Use common trade words (mzigo, kontena, ushuru, msambazaji, wakala wa forodha, bandari) and keep English terms traders use, such as LCL or demurrage, with a short Kiswahili explanation.
9. If the user is following up on an earlier answer, use the earlier details (goods, amount, origin, region) unless they change them.`;

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
  if (!(await turnstileOk(request, env, body.turnstile))) return json({ error: "bot_check_failed" }, 403); // Turnstile, once TURNSTILE_SECRET is set
  let sw = body.lang === "sw";
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
  if (!sw && /\b(nini|gani|vipi|nataka|nahitaji|kutoka|kiasi|bei|mzigo|ushuru|vibali|kibali|hadi|vya|za|kwa|gharama|msambazaji|habari)\b/i.test(question)) sw = true; // a Kiswahili question gets a Kiswahili answer
  let fxTime = "";
  try { // the calculator reads today's rate the same way the tool pages do
    const fx = await liveRates(); fxTime = fx.time;
    globalThis.window = globalThis.window || {}; globalThis.window.RAMANI_LIVE = { usd: fx.usd, rates_time: fx.time };
  } catch {}
  const qid = "q_" + crypto.randomUUID().slice(0, 18);
  if (env.DB) { // keep the questions: they show what content to make next
    try { await env.DB.prepare("INSERT INTO questions (id, asked_at, page, lang, question) VALUES (?1, ?2, ?3, ?4, ?5)").bind(qid, new Date().toISOString(), String(body.page || "").slice(0, 120), sw ? "sw" : "en", question.slice(0, 1000)).run(); } catch {}
  }
  const clean = (t) => fixLinks(String(t).replace(/[—–]/g, ","), sw);
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_MODEL) { // 1. Claude, when Ramani adds a key
    try {
      const text = await claudeWithTools(env, { system: RULES + "\nSite language: " + (sw ? "Kiswahili" : "English") + ". Page: " + String(body.page || "").slice(0, 80), messages: turns, tools: TOOLS, run });
      if (text) return json({ text: clean(text), by: "claude" });
    } catch {}
  }
  // Private check for Ramani's team: header x-uliza-debug equal to EMAIL_SECRET shows errors and can try another model.
  const debug = !!env.EMAIL_SECRET && request.headers.get("x-uliza-debug") === env.EMAIL_SECRET;
  if (workersAIReady(env) && (await underDailyCap(env))) { // 2. Cloudflare Workers AI, free tier
    try {
      const t0 = Date.now();
      const facts = factsFor(core, question, sw, chatContext(turns));
      const block = facts.plan ? planBlock(facts.plan, sw) : "";
      let text = await workersAIAnswer(env, { rules: RULES, facts, turns, sw, model: debug && body.model ? String(body.model) : null, raw: debug, numbersShown: !!block });
      if (block && typeof text === "string") {
        // the numbers come from the block only: drop any model line that still carries a number
        text = text.split("\n").filter((l) => !/\d/.test(l.replace(/\[[^\]]*\]\([^)]*\)/g, ""))).join("\n").trim();
        text = block + "\n\n" + text;
      }
      if (debug && text && typeof text === "object") return json({ debug: text, ms: Date.now() - t0 });
      if (text) {
        if (env.DB) { try { await env.DB.prepare("UPDATE questions SET answered_by = 'workers_ai' WHERE id = ?1").bind(qid).run(); } catch {} }
        return json({ text: clean(text), by: "workers_ai" });
      }
    } catch (e) { if (debug) return json({ error: String(e && e.message || e).slice(0, 500) }, 500); }
  } else if (debug) return json({ error: "no AI binding or daily cap reached", ai: workersAIReady(env) }, 500);
  return json({ error: "brain_unavailable" }, 503); // 3. the page answers from Ramani's tools on its own
}
