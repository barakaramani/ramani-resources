// Public: every live Learn post (published and not scheduled for later). Drafts never leave the database.
import { livePosts } from "../../../lib/learn.js";
import { json } from "../../../lib/contact.js";

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ posts: [] });
  try {
    const posts = await livePosts(env);
    return new Response(JSON.stringify({ posts }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } });
  } catch (e) {
    return json({ posts: [], error: "not_ready" }); // before schema_v7.sql is run
  }
}
