// Staff: upload a cover or body image for a Learn post to R2 (binding LEARN_IMAGES). Served at /_blob/<id>.
import { editor } from "../../../../lib/learn.js";
import { json } from "../../../../lib/contact.js";

const TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

export async function onRequestPost({ request, env }) {
  const who = await editor(request, env); if (who.reply) return who.reply;
  if (!env.LEARN_IMAGES) return json({ error: "images_not_set_up" }, 503);
  const type = String(request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!TYPES[type]) return json({ error: "png_jpg_webp_or_gif_only" }, 415);
  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return json({ error: "empty_file" }, 400);
  if (buf.byteLength > 10 * 1024 * 1024) return json({ error: "over_10_mb" }, 413);
  const id = crypto.randomUUID().replace(/-/g, "") + "." + TYPES[type];
  await env.LEARN_IMAGES.put("learn/" + id, buf, { httpMetadata: { contentType: type }, customMetadata: { by: who.email } });
  return json({ id, url: "/_blob/" + id });
}
