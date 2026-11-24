# Ramani Resources

The Ramani resource site for Tanzanian importers, plus the backend that runs on Cloudflare.

**What is in it**
- Free tools: landed cost, permits, order timeline, container load, clearing cost, demurrage, invoices and more.
- The resource library, the Academy, the glossary, downloads and the importer report.
- The Biashara Tanzania community page.
- Uliza Ramani, the AI assistant.
- The staff sales desk and the newsletter page.

**Built by:** Baraka Mafole (Growth and Community).
**Reviewed and deployed by:** Calvin Usiri (CTO).

## How the repo is laid out

| Folder | What it is |
|---|---|
| `site/` | The website: static HTML, CSS and JS, in English with a Kiswahili switch. This is the Cloudflare Pages output folder. |
| `site/config.js` | Site settings: where forms post and where Uliza Ramani asks. |
| `site/admin/` | Staff pages. Protect them with Cloudflare Access. |
| `functions/` | Cloudflare Pages Functions, the backend: `/api/lead`, `/api/uliza`, `/api/brief`, `/api/semacall/*`, `/api/sms/*` (Ghala) and `/api/email/*`. |
| `lib/` | Shared backend code: the Claude API, Resend email (Amazon SES as a fallback), Ghala SMS, SemaCall adapter, MQL scoring, calculators and knowledge base. |
| `db/` | Database tables for Cloudflare D1. Run them in order: `schema.sql`, `schema_v2.sql`, `schema_v3.sql`, `schema_v4.sql`. |
| `docs/BACKEND.md` | Full backend notes: every endpoint, all the secrets, the SemaCall and Ghala questions, and the Resend and Ghala setup. |

## Cloudflare Pages settings

- **Framework preset:** None
- **Build command:** leave empty
- **Build output directory:** `site`
- **Root directory:** `/` (the repo root, so that `functions/` is picked up)
- **D1 binding:** variable name `DB`. Use one database for previews and a separate one for production.
- **Secrets:** see `docs/BACKEND.md`. The site works without them: forms save leads, and Uliza Ramani answers from the tools until the Claude key is added.

Every pull request gets its own preview link. Pages on `*.pages.dev` are marked noindex (in `functions/_middleware.js`), so they never compete with ramani.io in Google.

## How we work

1. Baraka builds on a branch and opens a pull request that says what changed and how to test it.
2. Cloudflare builds a preview link for the pull request.
3. Calvin tests the preview, approves and merges to `main`, which deploys to the live site.
4. Calvin owns the secrets, the production database changes, Cloudflare Access and the domains.

**Recommended:** protect the `main` branch so that every change needs Calvin's approval.

## Still to do before going live

- [ ] Move the repo to Ramani's GitHub organisation, then reconnect Cloudflare Pages.
- [ ] Connect ramani.io: route `/tools/*` and `/resources` to this project (see the SEO plan), and verify `news.ramani.io` in Resend.
- [ ] Add the secrets: Claude API, Resend (`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`), Ghala (`GHALA_SMS_KEY`, `GHALA_SENDER_ID`, `GHALA_WEBHOOK_SECRET`), Turnstile bot check (`TURNSTILE_SECRET`, Secret; the public site key is in `site/config.js`), SemaCall and `EMAIL_SECRET`.
- [ ] Run the four database files on the production D1 database.
- [ ] Protect `/admin/*`, `/sales-desk.html`, `/api/brief*`, `/api/semacall/push*`, `/api/semacall/send-sms*`, `/api/email/campaign*` and `/api/email/send-batch*` with Cloudflare Access, then set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` (staff routes stay closed until then).
- [ ] Remove the "test inbox" and "Prototype" notes from the tools pages once the live database is connected.
- [ ] Have compliance and Iain clear all finance wording ("subject to assessment").
