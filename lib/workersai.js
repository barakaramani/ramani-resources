// Uliza Ramani on Cloudflare Workers AI (free tier). Used when there is no Claude key.
// Setup: Cloudflare Pages project > Settings > Bindings > Add > Workers AI, variable name AI. Then redeploy.
// Optional env: WORKERS_AI_MODEL (default @cf/meta/llama-3.3-70b-instruct-fp8-fast), UL_DAILY_CAP (default 200 answers a day).
// Workers AI gives 10,000 free Neurons a day. One Uliza answer on Llama 3.3 uses about 35 to 45, so 200 a day stays inside it.
// Reasoning models such as GLM 4.7 Flash spend the token budget thinking and return no answer, so they are not used here.
// Small models are less reliable at calling tools, so we look up Ramani's own facts first and the model only writes the answer.

export const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export function workersAIReady(env) { return !!(env.AI && typeof env.AI.run === "function"); }

// Counts today's AI answers in D1 so Uliza never goes past the free allowance. Returns true if there is room.
export async function underDailyCap(env) {
  const cap = Number(env.UL_DAILY_CAP || 200);
  if (!env.DB) return true;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM questions WHERE asked_at >= ?1 AND answered_by = 'workers_ai'").bind(day).first();
    return (r && r.n) < cap;
  } catch { return true; } // before the answered_by column exists we cannot count; the AI service has its own free limit
}

// Facts from Ramani's own tools for this question: matching resources, a calculated plan when there is an amount, permits, glossary words.
// ctx carries what earlier messages in the chat already said (a plan, the kind of goods), so a follow up such as
// "and to Arusha?" or "which permits for that?" still gets the right facts.
export function factsFor(core, question, sw, ctx = {}) {
  const facts = {};
  try { facts.resources = core.search(question, 5).map((r) => ({ title: sw ? r.title_sw : r.title, url: r.url, about: sw ? r.about_sw : r.about })); } catch {}
  try {
    const p = ctx.plan || core.parsePlan(question);
    if (p && p.goods && p.value_usd) facts.plan = core.plan(p);
  } catch {}
  try { const g = core.goods(question) || ctx.goods; if (g) facts.permits = core.permits(g).map((x) => ({ agency: x.agency, rule: sw ? x.sw : x.en })); } catch {}
  try { const d = core.define(question); if (d && d.length) facts.glossary = d.slice(0, 3); } catch {}
  return facts;
}

export async function workersAIAnswer(env, { rules, facts, turns, sw, model: pick, raw, numbersShown }) {
  const model = pick || env.WORKERS_AI_MODEL || DEFAULT_MODEL;
  const system = rules +
    "\n10. Use ONLY the facts in RAMANI_FACTS below for any number, rule, permit or link. If the facts do not answer the question, say so briefly and point to the best link or a Ramani BDM." +
    "\n11. Links must be exactly the url values in RAMANI_FACTS, written as markdown links whose text is the resource title from RAMANI_FACTS, never a file name." +
    (numbersShown
      ? "\n12. The user already sees a block with the plan's numbers above your reply. Do NOT repeat or restate any number. Write at most 2 short sentences of practical advice for this import, then the links."
      : "\n12. If RAMANI_FACTS has a plan, answer with its main numbers: shipping option, duty band, duty and VAT in TZS, landed cost in TZS, the 30 percent deposit and days to the shop. Say they are estimates from Ramani's calculator.") +
    "\n13. If the user asks about finance or paying the supplier, say Ramani can pay the supplier and they repay as they sell, subject to assessment, and link the readiness score." +
    (numbersShown ? "" : "\n14. When you give TZS amounts, add one short line that they use today's exchange rate (usd_tzs_rate in the plan) and that bank, bureau and TRA customs rates may differ.") +
    "\nReply language: " + (sw ? "Kiswahili" : "English") + "." +
    "\nRAMANI_FACTS:\n" + JSON.stringify(facts).slice(0, 6000);
  const r = await env.AI.run(model, {
    messages: [{ role: "system", content: system }, ...turns],
    max_completion_tokens: 700, max_tokens: 700, temperature: 0.2,
  });
  if (raw) return { model, result: r };
  const text = (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || "";
  return String(text).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
