// Minimal Claude API client for Cloudflare Pages Functions.
// Needs: env.ANTHROPIC_API_KEY (secret), env.ANTHROPIC_MODEL (fast model id, e.g. the Haiku 5.5 id from the models page),
// optional env.ANTHROPIC_MODEL_SMART (e.g. the Sonnet 5.5 id) for call summaries and briefs.

const API = "https://api.anthropic.com/v1/messages";

export async function claude(env, { system, messages, tools, maxTokens = 700, smart = false }) {
  const model = (smart && env.ANTHROPIC_MODEL_SMART) || env.ANTHROPIC_MODEL;
  if (!env.ANTHROPIC_API_KEY || !model) throw new Error("Claude is not configured: set ANTHROPIC_API_KEY and ANTHROPIC_MODEL");
  const body = { model, max_tokens: maxTokens, messages };
  if (system) body.system = [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]; // the long Ramani rules are cached
  if (tools && tools.length) body.tools = tools;
  const r = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Claude API " + r.status + ": " + (await r.text()).slice(0, 300));
  return r.json();
}

// Runs the tool loop: Claude may call page style tools (run here, in our code) a few times, then answers.
export async function claudeWithTools(env, { system, messages, tools, run, maxRounds = 4, maxTokens = 700, smart = false }) {
  const convo = messages.slice();
  for (let round = 0; round < maxRounds; round++) {
    const res = await claude(env, { system, messages: convo, tools, maxTokens, smart });
    const uses = (res.content || []).filter((b) => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length) {
      return (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    }
    convo.push({ role: "assistant", content: res.content });
    const results = [];
    for (const u of uses) {
      let content, is_error = false;
      try { content = JSON.stringify(await run(u.name, u.input || {})).slice(0, 30000); }
      catch (e) { content = "Error: " + e.message; is_error = true; }
      results.push({ type: "tool_result", tool_use_id: u.id, content, is_error });
    }
    convo.push({ role: "user", content: results });
  }
  // Out of rounds: ask for a final answer with no tools.
  const last = await claude(env, { system, messages: convo.concat([{ role: "user", content: "Answer now with what you have." }]), maxTokens, smart });
  return (last.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

// Asks for JSON and parses the first JSON object in the reply.
export async function claudeJSON(env, { system, prompt, maxTokens = 900, smart = true }) {
  const res = await claude(env, { system, messages: [{ role: "user", content: prompt }], maxTokens, smart });
  const text = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in reply");
  return JSON.parse(m[0]);
}
