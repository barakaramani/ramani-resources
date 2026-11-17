// POST /api/semacall/push {person_id, owner_bdm?}  ·  Staff only. Sends a scored lead with its brief to a BDM's SemaCall queue.
import { makeBrief } from "../brief.js";
import { pushLead } from "../../../lib/semacall.js";
import { json, staff } from "../../../lib/contact.js";

export async function onRequestPost({ request, env }) {
  const who = staff(request); if (!who) return json({ error: "staff_only" }, 401);
  const body = await request.json().catch(() => ({}));
  const b = await makeBrief(env, String(body.person_id || ""));
  if (!b) return json({ error: "not_found" }, 404);
  if (!b.person.phone) return json({ error: "no_phone" }, 400);
  const owner = body.owner_bdm || b.person.owner_bdm || who;
  const res = await pushLead(env, { person: b.person, brief: b.brief, score: b.score, owner });
  await env.DB.prepare("UPDATE people SET owner_bdm = ?2 WHERE id = ?1").bind(b.person.id, owner).run();
  return json({ ok: true, owner, score: b.score, semacall: res });
}
