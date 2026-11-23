// Staff: save (PUT), change (PATCH, for example publish or unpublish) or delete (DELETE) one Learn post.
// If LEARN_PUBLISHERS is set, only those emails can make a post live, change a live post or delete one.
import { editor, canPublish, prepare, save, fromRow, SLUG } from "../../../../../lib/learn.js";
import { json } from "../../../../../lib/contact.js";

async function current(env, id) {
  const r = await env.DB.prepare("SELECT id, doc FROM learn_posts WHERE id = ?1").bind(id).first();
  return r ? fromRow(r) : null;
}
async function body(request) { try { return await request.json(); } catch { return null; } }

export async function onRequest({ request, env, params }) {
  const who = await editor(request, env); if (who.reply) return who.reply;
  const id = String(params.id || "").toLowerCase();
  if (!SLUG.test(id) || id.length > 100) return json({ error: "bad_link" }, 400);
  const was = await current(env, id);
  const mayPublish = canPublish(env, who.email);

  if (request.method === "DELETE") {
    if (!was) return json({ ok: true });
    if (!mayPublish) return json({ error: "needs_publisher" }, 403);
    await env.DB.prepare("DELETE FROM learn_posts WHERE id = ?1").bind(id).run();
    return json({ ok: true });
  }
  if (request.method !== "PUT" && request.method !== "PATCH") return json({ error: "method" }, 405);

  const b = await body(request); if (!b || typeof b !== "object") return json({ error: "bad_json" }, 400);
  if (request.method === "PATCH" && !was) return json({ error: "not_found" }, 404);
  const d = prepare(request.method === "PATCH" ? Object.assign({}, was, b) : b);
  if (!d.title) return json({ error: "needs_title" }, 400);
  if ((d.published || (was && was.published)) && !mayPublish) return json({ error: "needs_publisher" }, 403);
  if (was && was.createdAt) d.createdAt = was.createdAt; else d.createdAt = d.createdAt || Date.now();
  return save(env, id, d, who.email);
}
