// GET or POST /api/email/unsubscribe?p=PERSON&t=TOKEN  ·  One click unsubscribe from marketing email (works from Gmail's button too).
import { checkUnsub } from "../../../lib/email.js";

async function handle({ request, env }) {
  const u = new URL(request.url), p = u.searchParams.get("p"), t = u.searchParams.get("t");
  const ok = await checkUnsub(env, p, t);
  if (ok) await env.DB.prepare("UPDATE people SET email_opt_out = 1 WHERE id = ?1").bind(p).run();
  if (request.method === "POST") return new Response(ok ? "ok" : "invalid", { status: ok ? 200 : 400 });
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ramani</title>
<body style="font-family:Arial;max-width:520px;margin:60px auto;padding:0 16px;color:#16211a"><h1 style="color:#04C401">ramani</h1>
${ok ? "<p><b>You are unsubscribed.</b> You will not get Ramani marketing emails any more.</p><p><b>Umejiondoa.</b> Hutapokea tena barua pepe za matangazo za Ramani.</p>"
      : "<p>This link is not valid. Please use the link in your latest email.</p><p>Kiungo hiki si sahihi. Tumia kiungo kilicho kwenye barua pepe yako ya karibuni.</p>"}</body>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } });
}
export const onRequestGet = handle;
export const onRequestPost = handle;
