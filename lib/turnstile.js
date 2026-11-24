// Cloudflare Turnstile bot check for public forms (/api/lead) and Uliza Ramani (/api/uliza).
// Env: TURNSTILE_SECRET (Secret). Until it is set, nothing is checked, so the site keeps working during setup.
// The browser side lives in site/config.js: it gets a token in the background and adds it to each request as "turnstile".
// If Cloudflare's check service itself cannot be reached we let the request through (fail open), so a Cloudflare
// outage never loses real leads; a token that Cloudflare says is wrong, missing or reused is refused.
export async function turnstileOk(request, env, token) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(token).slice(0, 2048), remoteip: request.headers.get("cf-connecting-ip") || "" }),
    });
    if (!r.ok) return true;
    const v = await r.json();
    return !!v.success;
  } catch {
    return true;
  }
}
