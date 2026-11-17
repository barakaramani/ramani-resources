// SemaCall adapter. SemaCall has not published its API, so every field name and path below is a placeholder
// to confirm with SemaCall. Only this file changes when we get their documentation.
// Env: SEMACALL_API_BASE, SEMACALL_API_KEY, SEMACALL_LEAD_PATH (default /leads), SEMACALL_SMS_PATH (default /sms/send),
//      SEMACALL_SENDER (the approved SMS sender name, for example RAMANI).

async function call(env, path, payload) {
  if (!env.SEMACALL_API_BASE || !env.SEMACALL_API_KEY) throw new Error("SemaCall is not configured");
  const r = await fetch(env.SEMACALL_API_BASE.replace(/\/$/, "") + path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.SEMACALL_API_KEY }, // TODO confirm auth style
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  if (!r.ok) throw new Error("SemaCall " + r.status + ": " + text.slice(0, 200));
  try { return JSON.parse(text); } catch { return { ok: true, raw: text.slice(0, 200) }; }
}

// Put an MQL in a BDM's queue, with the call brief as the note.
export function pushLead(env, { person, brief, score, owner }) {
  return call(env, env.SEMACALL_LEAD_PATH || "/leads", { // TODO confirm field names
    name: person.name || "", phone: person.phone, email: person.email || "", source: "Ramani website",
    score, owner, note: brief, external_id: person.id,
  });
}

// Send an SMS a BDM has approved. Never called without a human approval.
export function sendSms(env, { to, text }) {
  return call(env, env.SEMACALL_SMS_PATH || "/sms/send", { to, message: text, sender: env.SEMACALL_SENDER || "RAMANI" }); // TODO confirm
}

// Turn whatever SemaCall posts to our webhook into one shape. Extend once we see real payloads.
export function normalise(p) {
  const kind = String(p.event || p.type || p.event_type || "").toLowerCase();
  const isSms = /sms|message/.test(kind);
  return {
    type: isSms ? "sms.received" : /call/.test(kind) ? "call.completed" : kind || "unknown",
    phone: p.customer_number || p.from || p.caller || p.phone || (p.customer && p.customer.phone) || "",
    bdm: p.agent_email || p.agent || p.user || (p.agent_info && p.agent_info.email) || "",
    direction: p.direction || (isSms ? "inbound" : ""),
    duration: +p.duration || +p.billsec || 0,
    recording_url: p.recording_url || p.recording || "",
    transcript: p.transcript || p.transcription || "",
    notes: p.notes || p.disposition_note || "",
    disposition: p.disposition || p.outcome || "",
    text: p.text || p.message || p.body || "",
    external_id: p.call_id || p.id || p.message_id || "",
    at: p.timestamp || p.created_at || new Date().toISOString(),
  };
}
