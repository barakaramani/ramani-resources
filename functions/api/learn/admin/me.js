// Staff: who is signed in to the Learn editor and whether they may publish.
import { editor, canPublish, nameFrom } from "../../../../lib/learn.js";
import { json } from "../../../../lib/contact.js";

export async function onRequestGet({ request, env }) {
  const who = await editor(request, env); if (who.reply) return who.reply;
  return json({ email: who.email, name: nameFrom(who.email), canPublish: canPublish(env, who.email) });
}
