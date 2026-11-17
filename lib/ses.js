// Send one email through Amazon SES (API v2). Env: SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY,
// SES_FROM (for example "Ramani <news@news.ramani.io>"), optional SES_CONFIG_SET (for bounce and complaint events).
import { signRequest } from "./sigv4.js";

export function sesReady(env) { return !!(env.SES_REGION && env.SES_ACCESS_KEY_ID && env.SES_SECRET_ACCESS_KEY && env.SES_FROM); }

export async function sesSend(env, { to, subject, html, text, headers = [], tags = [] }) {
  const host = `email.${env.SES_REGION}.amazonaws.com`, path = "/v2/email/outbound-emails";
  const msg = { Subject: { Data: subject, Charset: "UTF-8" }, Body: { Html: { Data: html, Charset: "UTF-8" } } };
  if (text) msg.Body.Text = { Data: text, Charset: "UTF-8" };
  if (headers.length) msg.Headers = headers.map(([Name, Value]) => ({ Name, Value }));
  const payload = { FromEmailAddress: env.SES_FROM, Destination: { ToAddresses: [to] }, Content: { Simple: msg } };
  if (env.SES_CONFIG_SET) payload.ConfigurationSetName = env.SES_CONFIG_SET;
  if (tags.length) payload.EmailTags = tags.map(([Name, Value]) => ({ Name, Value: String(Value).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) }));
  const body = JSON.stringify(payload);
  const h = await signRequest({ method: "POST", host, path, headers: { "content-type": "application/json" }, body, region: env.SES_REGION, service: "ses", accessKeyId: env.SES_ACCESS_KEY_ID, secretAccessKey: env.SES_SECRET_ACCESS_KEY });
  const r = await fetch(`https://${host}${path}`, { method: "POST", headers: h, body });
  const t = await r.text();
  if (!r.ok) throw new Error("SES " + r.status + ": " + t.slice(0, 300));
  return JSON.parse(t).MessageId;
}
