// In code rate limiting for the public API, on top of Cloudflare's zone rate limiting rules (see docs/SECURITY.md).
// Fixed one minute windows per visitor IP and route group, counted in D1 (table rate_limits, db/schema_v8.sql).
// IPs are stored only as a short salted hash. If the table is missing or D1 has a problem we let the request
// through (fail open), so a database hiccup never takes the site down; Cloudflare's own rules still apply.

// Route groups, checked in order. limit = requests per minute per IP. Webhooks from Ghala, Resend, SES and
// SemaCall are not limited here: they are signed by the provider and can arrive in bursts.
export const RULES = [
  { name: "lead", test: (p) => p === "/api/lead", limit: 20 },
  { name: "uliza", test: (p) => p === "/api/uliza", limit: 10 },
  { name: "c_auth", test: (p) => p.startsWith("/api/c/auth/"), limit: 5 },
  { name: "c_write", test: (p) => p.startsWith("/api/c/"), limit: 30 },
  { name: "staff", test: (p) => p.startsWith("/api/learn/admin/") || p.startsWith("/api/sms/test") || p.startsWith("/api/email/campaign") || p.startsWith("/api/email/send-batch") || p.startsWith("/api/semacall/push") || p.startsWith("/api/semacall/send-sms") || p.startsWith("/api/brief"), limit: 30 },
];
const WEBHOOKS = ["/api/sms/ghala-events", "/api/email/resend-events", "/api/email/ses-events", "/api/semacall/webhook"];

export function ruleFor(method, path) {
  if (!path.startsWith("/api/") || WEBHOOKS.some((w) => path.startsWith(w))) return null;
  const rule = RULES.find((r) => r.test(path));
  // reads are cheap, so GET is only limited on staff routes; every other method is limited everywhere
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return rule && rule.name === "staff" ? rule : null;
  return rule || { name: "api", limit: 60 };
}

async function ipHash(env, ip) {
  const salt = env.RATE_SALT || env.EMAIL_SECRET || "ramani";
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + ip));
  return [...new Uint8Array(d)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Returns null when the request may go ahead, or { retryAfter } in seconds when it is over the limit.
export async function overLimit(env, request, rule) {
  if (!rule || !env.DB) return null;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now(), win = Math.floor(now / 60000);
  const key = rule.name + ":" + (await ipHash(env, ip)) + ":" + win;
  try {
    const r = await env.DB.prepare("INSERT INTO rate_limits (k, n, reset_at) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n")
      .bind(key, (win + 1) * 60000).first();
    if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM rate_limits WHERE reset_at < ?1").bind(now - 60000).run();
    if (r && r.n > rule.limit) return { retryAfter: Math.max(1, Math.ceil(((win + 1) * 60000 - now) / 1000)) };
  } catch {}
  return null;
}
