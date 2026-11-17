// AWS Signature Version 4 for Cloudflare Workers (Web Crypto, no dependencies).
const enc = (s) => new TextEncoder().encode(s);
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha256(s) { return hex(await crypto.subtle.digest("SHA-256", typeof s === "string" ? enc(s) : s)); }
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? enc(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc(msg)));
}

// Returns the headers to send: Authorization, X-Amz-Date and X-Amz-Content-Sha256 plus the ones you passed.
export async function signRequest({ method, host, path, query = "", headers = {}, body = "", region, service, accessKeyId, secretAccessKey, now = new Date() }) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256(body);
  const h = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])), host, "x-amz-date": amzDate };
  const names = Object.keys(h).sort();
  const canonical = [method, path, query, names.map((n) => n + ":" + h[n]).join("\n") + "\n", names.join(";"), payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonical)].join("\n");
  let k = await hmac("AWS4" + secretAccessKey, dateStamp);
  k = await hmac(k, region); k = await hmac(k, service); k = await hmac(k, "aws4_request");
  const signature = hex(await hmac(k, toSign));
  return { ...headers, "x-amz-date": amzDate, "x-amz-content-sha256": payloadHash,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}` };
}
