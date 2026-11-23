// Ramani Learn blog: shared helpers for the public read API, the staff editor API and the SEO post pages.
// Writing is staff only (Cloudflare Access, see staff() in contact.js). Env:
//   LEARN_PUBLISHERS  optional comma list of emails allowed to publish, schedule, unpublish or delete.
//                     When empty, every signed in staff member can publish.
//   LEARN_IMAGES      optional R2 bucket binding for cover and body images (served at /_blob/<id>).
import { staff, json } from "./contact.js";

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_DOC = 400000; // characters of JSON per post

export function fromRow(r) {
  let d = {}; try { d = JSON.parse(r.doc) || {}; } catch {}
  d.id = r.id; d.slug = r.id; return d;
}

export async function livePosts(env, limit = 200) {
  const r = await env.DB.prepare("SELECT id, doc FROM learn_posts WHERE published = 1 AND published_at <= ?1 ORDER BY published_at DESC LIMIT ?2").bind(Date.now(), limit).all();
  return (r.results || []).map(fromRow);
}

export async function livePost(env, slug) {
  if (!SLUG.test(slug)) return null;
  const r = await env.DB.prepare("SELECT id, doc FROM learn_posts WHERE id = ?1 AND published = 1 AND published_at <= ?2").bind(slug, Date.now()).first();
  return r ? fromRow(r) : null;
}

const publishers = (env) => String(env.LEARN_PUBLISHERS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
export const canPublish = (env, email) => { const p = publishers(env); return !p.length || p.includes(String(email || "").toLowerCase()); };

// Signed in staff member, or a ready made 401 reply.
export async function editor(request, env) {
  const email = await staff(request, env);
  return email ? { email: email.toLowerCase() } : { reply: json({ error: "not_signed_in" }, 401) };
}

export function nameFrom(email) {
  const local = String(email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  return local.replace(/\b\w/g, (c) => c.toUpperCase()) || "Ramani team";
}

// Posts come only from signed in staff, but we still strip anything that can run code before saving.
export function clean(html) {
  return String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|template|noscript)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|template|noscript|meta|link|base)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src|xlink:href|action|formaction)\s*=\s*("|')\s*(javascript|vbscript|data:(?!image\/(png|jpe?g|gif|webp);))[^"']*\2/gi, ' $1="#"');
}

// Tidy a post sent by the editor before it is stored.
export function prepare(doc) {
  const d = Object.assign({}, doc || {});
  delete d.id; delete d.slug;
  d.html = clean(d.html);
  d.published = d.published === true;
  d.publishedAt = Number(d.publishedAt) || Date.now();
  d.updatedAt = Date.now();
  return d;
}

export async function save(env, id, d, email) {
  const body = JSON.stringify(d);
  if (body.length > MAX_DOC) return json({ error: "post_too_long" }, 413);
  await env.DB.prepare("INSERT INTO learn_posts (id, published, published_at, updated_at, updated_by, doc) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(id) DO UPDATE SET published = excluded.published, published_at = excluded.published_at, updated_at = excluded.updated_at, updated_by = excluded.updated_by, doc = excluded.doc")
    .bind(id, d.published ? 1 : 0, d.publishedAt, d.updatedAt, email, body).run();
  return json({ ok: true, id });
}

export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
