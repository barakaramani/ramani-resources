// Ramani emails: templates in English and Kiswahili, unsubscribe tokens, and one safe send function.
// Provider: Resend by default (RESEND_API_KEY). Amazon SES stays as a fallback; set EMAIL_PROVIDER = "ses" to force it.
import { sesSend, sesReady } from "./ses.js";
import { resendSend, resendReady } from "./resend.js";

export function emailProvider(env) {
  const want = String(env.EMAIL_PROVIDER || "").toLowerCase();
  if (want === "ses") return sesReady(env) ? "ses" : null;
  if (want === "resend") return resendReady(env) ? "resend" : null;
  return resendReady(env) ? "resend" : sesReady(env) ? "ses" : null;
}

const SITE = (env) => (env.SITE_URL || "https://www.ramani.io").replace(/\/$/, "");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function sign(env, s) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.EMAIL_SECRET || "set-EMAIL_SECRET"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const b = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(s)));
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c])).slice(0, 32);
}
export async function unsubLink(env, personId) { return `${SITE(env)}/api/email/unsubscribe?p=${encodeURIComponent(personId)}&t=${await sign(env, "u:" + personId)}`; }
export async function checkUnsub(env, personId, token) { return !!personId && token === await sign(env, "u:" + personId); }

// Wraps any body in Ramani's simple branded layout with the legal footer.
export function layout({ lang, preheader, bodyHtml, unsub, site }) {
  const sw = lang === "sw", SITE_URL_FOR_LOGO = (site || "https://ramani-resources.pages.dev").replace(/\/$/, "");
  return `<!doctype html><html lang="${sw ? "sw" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#F7F9FF;font-family:Arial,Helvetica,sans-serif;color:#1E222E">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader || "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px">
<tr><td style="padding:22px 26px 6px"><img src="${SITE_URL_FOR_LOGO}/brand/ramani-wordmark.png" width="110" height="24" alt="Ramani" style="display:block;border:0"></td></tr>
<tr><td style="padding:6px 26px 22px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
</table>
<p style="max-width:560px;font-size:12px;color:#4B5563;line-height:1.5;margin:16px auto 0">Ramani · Isale House, Mikocheni, Dar es Salaam, Tanzania<br>
${sw ? "Umepokea barua pepe hii kwa sababu ulijiandikisha kwenye zana au jarida la Ramani." : "You are getting this email because you signed up on a Ramani tool or newsletter."}
<a href="${unsub}" style="color:#4B5563">${sw ? "Jiondoe" : "Unsubscribe"}</a></p>
</td></tr></table></body></html>`;
}
const btn = (href, label) => `<p style="margin:20px 0"><a href="${href}" style="background:#04C401;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px;display:inline-block">${esc(label)}</a></p>`;

// Academy courses for the enrolment email. Kept on the server, so a form can never put its own text into an email.
const COURSES = {
  first: { title: ["Your first import from China", "Uagizaji wako wa kwanza kutoka China"], lessons: [["Choose what to import", "Chagua cha kuagiza"], ["Find and check a supplier", "Tafuta na mkague msambazaji"], ["Pay safely", "Lipa kwa usalama"], ["Ship with a cargo agent", "Safirisha kupitia wakala wa mizigo"]] },
  container: { title: ["From shared loads to a full container", "Kutoka mzigo wa pamoja hadi kontena zima"], lessons: [["When a full container pays", "Lini kontena zima linalipa"], ["Plan the order backwards", "Panga oda kurudi nyuma"], ["The cash a container needs", "Pesa zinazohitajika kwa kontena"], ["Funding your first container", "Kugharamia kontena lako la kwanza"]] },
  clearing: { title: ["Clearing without surprises", "Kutoa mzigo bila mshangao"], lessons: [["The documents you need", "Nyaraka unazohitaji"], ["Duty and taxes", "Ushuru na kodi"], ["Port charges and free days", "Gharama za bandari na siku za bure"], ["Working with your clearing agent", "Kufanya kazi na wakala wako wa forodha"]] },
};

// The automatic emails a form submission can trigger. Return null for types that send nothing.
export function autoEmail(env, type, d, lang) {
  const sw = lang === "sw", n = esc(String(d.name || "").split(" ")[0]), S = SITE(env);
  const hi = n ? (sw ? `Habari ${n},` : `Hi ${n},`) : (sw ? "Habari," : "Hi,");
  if (type === "newsletter") return { kind: "marketing", subject: sw ? "Karibu kwenye jarida la Ramani" : "Welcome to the Ramani newsletter",
    preheader: sw ? "Kila Jumatatu: dola, yuan, bandari na kidokezo kimoja." : "Every Monday: the dollar, the yuan, the port and one tip.",
    body: `<p>${hi}</p><p>${sw ? "Asante kwa kujiunga. Kila Jumatatu utapokea kiwango cha dola na yuan, habari za bandari ya Dar es Salaam na kidokezo kimoja cha uagizaji." : "Thanks for joining. Every Monday you will get the dollar and yuan rate, news from Dar es Salaam port and one import tip you can use that week."}</p>${btn(S + "/resources", sw ? "Fungua zana za bure" : "Open the free tools")}<p>${sw ? "Timu ya Ramani" : "The Ramani team"}</p>` };
  if (type === "download") return { kind: "service", subject: sw ? "Kipakuliwa chako kutoka Ramani" : "Your download from Ramani",
    preheader: sw ? "Kiungo chako kiko hapa." : "Your link is here.",
    body: `<p>${hi}</p><p>${sw ? "Hiki ndicho kiungo cha ulichopakua, ukikihitaji tena:" : "Here is the link to what you downloaded, in case you need it again:"}</p>${btn(S + "/downloadables#" + encodeURIComponent(d.item || ""), sw ? "Fungua kipakuliwa" : "Open your download")}<p>${sw ? "Unahitaji pesa za kumlipa msambazaji? Ramani inaweza kusaidia, kwa kutegemea tathmini." : "Need cash to pay your supplier? Ramani can help, subject to assessment."}</p>` };
  if (type === "importer_survey") return { kind: "service", subject: sw ? "Asante kwa kujaza utafiti" : "Thank you for taking the importer survey",
    preheader: sw ? "Utapata ripoti kabla ya wengine." : "You will get the report before anyone else.",
    body: `<p>${hi}</p><p>${sw ? "Asante. Tutakutumia ripoti ya Hali ya Waagizaji wa Tanzania 2026 mara itakapokuwa tayari, kabla haijatolewa kwa umma." : "Thank you. We will send you the State of Tanzanian Importers 2026 report as soon as it is ready, before it is public."}</p>${btn(S + "/import-finance-readiness-score", sw ? "Pata kipimo chako cha utayari" : "Get your readiness score")}` };
  if (type === "tool_lead") return { kind: "marketing", subject: sw ? "Zana zako za bure za Ramani" : "Your free Ramani tools",
    preheader: sw ? "Kila zana sehemu moja." : "Every tool in one place.",
    body: `<p>${hi}</p><p>${sw ? "Karibu. Zana zote za Ramani ni bure: gharama ya mzigo kufika, vibali, ratiba ya oda, malipo kwa msambazaji na zaidi." : "Welcome. Every Ramani tool is free: landed cost, permits, order timelines, supplier payments and more."}</p>${btn(S + "/resources", sw ? "Fungua maktaba" : "Open the resource library")}` };
  if (type === "community_join") { // confirmation of the details and RSVP; the invite itself is sent by the Ramani team
    const rs = String(d.rsvp || "");
    const rsLine = rs === "Yes" ? (sw ? "Umethibitisha kuja kwenye mkutano ujao wa waagizaji. Tutakutumia tarehe na saa." : "You said yes to the next importers meetup. We will send you the date and time.")
      : rs === "Maybe" ? (sw ? "Tutakutumia tarehe ya mkutano ujao ili uamue." : "We will send you the date of the next meetup so you can decide.")
      : (sw ? "Tutakujulisha kuhusu vipindi vya mtandaoni." : "We will keep you posted about online sessions.");
    return { kind: "service", subject: sw ? "Tumepokea ombi lako la Biashara Tanzania" : "We have your Biashara Tanzania request",
      preheader: sw ? "Mwaliko wako unakuja hivi karibuni." : "Your invite is on its way soon.",
      body: `<p>${hi}</p><p>${sw ? "Asante kwa kuomba kujiunga na <b>Biashara Tanzania</b>, jumuiya ya waagizaji wa Tanzania. Timu ya Ramani inapitia kila ombi na itakutumia kiungo chako binafsi cha mwaliko kwa barua pepe hivi karibuni." : "Thank you for asking to join <b>Biashara Tanzania</b>, the community for Tanzanian importers. The Ramani team reviews every request and will email your personal invite link soon."}</p>
<p>${rsLine}</p><p>${sw ? "Wakati unasubiri, anza kozi ya bure kwenye Ramani Import Academy:" : "While you wait, start a free course in the Ramani Import Academy:"}</p>${btn(S + "/academy", sw ? "Fungua Academy" : "Open the Academy")}
<p style="font-size:13px;color:#4B5563">${sw ? "Unahitaji pesa ya kumlipa msambazaji? Ramani inaweza kusaidia, kwa kutegemea tathmini." : "Need cash to pay your supplier? Ramani can help, subject to assessment."}</p>` };
  }
  if (type === "academy_enroll") {
    const c = COURSES[d.item]; if (!c) return null;
    const list = c.lessons.map((l) => `<li style="margin:4px 0">${esc(sw ? l[1] : l[0])}</li>`).join("");
    return { kind: "service", subject: sw ? `Karibu kwenye kozi: ${c.title[1]}` : `You're in: ${c.title[0]}`,
      preheader: sw ? "Muhtasari wa kozi na kiungo cha kuendelea." : "Your course outline and a link to pick up where you left off.",
      body: `<p>${hi}</p><p>${sw ? `Karibu Ramani Import Academy. Umeanza kozi <b>${esc(c.title[1])}</b>. Ni bure, takriban dakika 20 za kusoma, pamoja na mifano na orodha za ukaguzi.` : `Welcome to Ramani Import Academy. You have started <b>${esc(c.title[0])}</b>. It is free and takes about 20 minutes to read, with worked examples and checklists.`}</p>
<p style="margin-bottom:4px"><b>${sw ? "Utakachosoma" : "What you will cover"}</b></p><ol style="margin-top:0;padding-left:20px">${list}<li style="margin:4px 0">${sw ? "Maswali 5 na cheti chenye jina lako" : "A 5 question quiz and a certificate with your name"}</li></ol>
<p>${sw ? "Kila somo lina hatua moja ya kufanya kwa zana ya bure ya Ramani na video za ziada." : "Every lesson has one practical step with a free Ramani tool, plus extra videos."}</p>${btn(S + "/academy#" + encodeURIComponent(d.item), sw ? "Endelea na kozi" : "Continue the course")}
<p style="font-size:13px;color:#4B5563">${sw ? "Unahitaji pesa ya kumlipa msambazaji? Ramani inaweza kusaidia, kwa kutegemea tathmini." : "Need cash to pay your supplier? Ramani can help, subject to assessment."}</p>` };
  }
  return null;
}

// Sends to one person only if an email provider is set up, they have an email, it has not bounced, and (for marketing) they agreed and did not unsubscribe.
export async function sendToPerson(env, person, { kind, subject, preheader, body, tags = [], idempotencyKey }) {
  const provider = emailProvider(env);
  if (!provider || !person || !person.email) return { skipped: "no_email_or_provider" };
  if (person.email_status === "bounced" || person.email_status === "complained") return { skipped: "suppressed" };
  if (kind === "marketing" && (person.email_opt_out || !person.email_consent)) return { skipped: "no_consent" };
  const unsub = await unsubLink(env, person.id);
  const html = layout({ lang: person.lang, preheader, bodyHtml: body, unsub, site: SITE(env) });
  const text = body.replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, "$2: $1").replace(/<[^>]+>/g, "\n").replace(/\n{2,}/g, "\n\n").trim() + "\n\nUnsubscribe: " + unsub;
  const msg = { to: person.email, subject, html, text, tags, idempotencyKey,
    headers: [["List-Unsubscribe", `<${unsub}>`], ["List-Unsubscribe-Post", "List-Unsubscribe=One-Click"]] };
  const id = provider === "resend" ? await resendSend(env, msg) : await sesSend(env, msg);
  return { sent: true, message_id: id, provider };
}
