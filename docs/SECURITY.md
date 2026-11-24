# Security for the public resource site

The site is public and most API routes need no login, so it is protected in layers.

## 1. Cloudflare Turnstile (done, on)

* Widget **Ramani resources forms**, hostnames `ramani-resources.pages.dev` and `ramani.io`.
* Public site key in `site/config.js`; secret in Pages as `TURNSTILE_SECRET` (Secret).
* `site/config.js` gets a token in the background and adds it to every request to `/api/lead`, `/api/uliza` and `/api/c/auth/start` (community sign in). Visitors normally see nothing; a doubtful visitor gets one tick box.
* The server check is `lib/turnstile.js`. Missing, wrong or reused tokens get `403 bot_check_failed`. If Cloudflare's check service itself is down, requests are let through so real leads are not lost.
* Health check: `GET /api/lead` returns `{"bot_check":"on"}` (never the key).

## 2. Rate limiting in code (done, needs `db/schema_v8.sql`)

`lib/ratelimit.js`, called from `functions/_middleware.js` before any API route runs. Fixed one minute windows per IP (stored only as a salted hash) in D1 table `rate_limits`. Over the limit returns `429` with `Retry-After`.

| Route | Limit per IP |
|---|---|
| `POST /api/lead` | 20 a minute |
| `POST /api/uliza` | 10 a minute (plus the daily AI cap `UL_DAILY_CAP`) |
| `POST /api/c/auth/*` (community sign in codes) | 5 a minute (plus 5 codes per email or phone an hour) |
| other `POST /api/c/*` | 30 a minute |
| staff routes (`/api/learn/admin/*`, `/api/sms/test`, `/api/email/campaign`, `/api/email/send-batch`, `/api/semacall/push`, `/api/semacall/send-sms`, `/api/brief`) | 30 a minute |
| any other non GET `/api/*` | 60 a minute |

Provider webhooks (`/api/sms/ghala-events`, `/api/email/resend-events`, `/api/email/ses-events`, `/api/semacall/webhook`) are not limited here because they are signed and can arrive in bursts. Optional env `RATE_SALT` sets the IP hash salt.

## 3. Request validation (done)

* `/api/lead`: body must be a JSON object under 20 KB; `type` must be a known form; `data` may hold at most 60 fields per object, nesting up to 3 levels, lists up to 100 items, text up to 2,000 characters, field names of letters, numbers, `_`, `.` and `-` only. Contacts are normalised (email, Tanzanian phone).
* `/api/uliza`: body under 20 KB, `messages` a list of at most 40 turns (only the last 10 are used, each cut to 1,500 characters), `lang` `en` or `sw`, `page` a short string. Personal numbers are redacted before the AI sees them.
* `/api/learn/admin/*`: staff only (Cloudflare Access token checked on the server), post HTML is cleaned of scripts and event handlers.

## 4. Security headers (done)

Set in `functions/_middleware.js` on every response:

* `Content-Security-Policy` on HTML pages: only this site plus Google Fonts, Turnstile, PostHog (after cookie consent) and YouTube embeds; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`. Inline scripts are still allowed because the pages are built with them; moving them to files would let us drop `'unsafe-inline'` later.
* `Strict-Transport-Security: max-age=31536000; includeSubDomains`
* `X-Content-Type-Options: nosniff`
* `X-Frame-Options: SAMEORIGIN`
* `Referrer-Policy: strict-origin-when-cross-origin`
* `Permissions-Policy`: camera, microphone, geolocation, payment and USB off
* `Cache-Control: no-store` on API answers that do not set their own

All 93 pages were loaded with this policy and none had blocked content.

## 5. Zone rate limiting rules (Calvin, once ramani.io points at this project)

`*.pages.dev` has no zone, so these rules go on the **ramani.io** zone: Security, WAF, Rate limiting rules, Create rule.

| Rule name | If incoming requests match | Characteristics | Rate | Action |
|---|---|---|---|---|
| Lead forms | `(http.request.uri.path eq "/api/lead" and http.request.method eq "POST")` | IP | 20 requests per 1 minute | Block for 1 minute |
| Uliza Ramani | `(http.request.uri.path eq "/api/uliza" and http.request.method eq "POST")` | IP | 10 requests per 1 minute | Block for 1 minute |
| Community sign in | `(starts_with(http.request.uri.path, "/api/c/auth/") and http.request.method eq "POST")` | IP | 5 requests per 1 minute | Block for 10 minutes |

On the Free plan only one rule with a 10 second window is allowed; use one combined rule instead:
`(http.request.method eq "POST" and (http.request.uri.path in {"/api/lead" "/api/uliza"} or starts_with(http.request.uri.path, "/api/c/auth/")))`, 5 requests per 10 seconds per IP, block for 10 seconds. The in code limits above still apply on any plan.
