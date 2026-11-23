// Staff: every Learn post, including drafts and scheduled posts, newest first.
import { editor, fromRow } from "../../../../../lib/learn.js";
import { json } from "../../../../../lib/contact.js";

export async function onRequestGet({ request, env }) {
  const who = await editor(request, env); if (who.reply) return who.reply;
  const r = await env.DB.prepare("SELECT id, doc FROM learn_posts ORDER BY COALESCE(published_at, updated_at) DESC LIMIT 500").all();
  return new Response(JSON.stringify({ posts: (r.results || []).map(fromRow) }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
