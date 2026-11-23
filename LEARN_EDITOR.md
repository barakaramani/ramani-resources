# Ramani Learn editor

Staff write and publish Learn posts at **/learn-admin**. Visitors only ever see live posts on the Learn page and at **/learn/&lt;post-link&gt;**.

## How it works

| Part | Where |
|---|---|
| Editor page (staff) | `functions/learn-admin.js` serves the Learn page in editor mode |
| Editor API (staff) | `functions/api/learn/admin/*`: who am I, list, save, publish, delete, image upload |
| Public API | `functions/api/learn/posts.js`: live posts only, never drafts |
| Post pages with SEO | `functions/learn/[slug].js`: title, description, canonical, social preview, article text for crawlers |
| Data | D1 `ramani-leads`, table `learn_posts` (`db/schema_v7.sql`) |
| Images | R2 bucket, binding `LEARN_IMAGES`, served at `/_blob/<id>` by `functions/_middleware.js` |
| Browser side | `site/learn-shim.js` connects the existing Learn page and editor to the API |

Security: every write is checked on the server against the signed Cloudflare Access token (`staff()` in `lib/contact.js`). Post HTML is cleaned of scripts, event handlers and javascript links before it is stored.

## Setup (Calvin)

1. **Database**: in the D1 console for `ramani-leads`, run `db/schema_v7.sql`.
2. **Cloudflare Access**: create (or extend) an Access application for Ramani staff covering
   `ramani-resources.pages.dev/learn-admin`, `ramani-resources.pages.dev/api/learn/admin/*`
   and the same paths on ramani.io once the domain is connected.
3. **Variables** (Pages project settings, Production):
   * `ACCESS_TEAM_DOMAIN`: for example `ramani.cloudflareaccess.com`
   * `ACCESS_AUD`: the Access application's AUD tag
   * `LEARN_PUBLISHERS` (optional): comma list of emails allowed to publish, unpublish or delete. Empty means every signed in staff member can publish; others can still save drafts.
4. **Images** (optional, for cover and body images): create an R2 bucket (for example `ramani-learn-images`) and bind it to the Pages project as `LEARN_IMAGES`. Without it, posts use the built in map art covers.
5. Redeploy, then open `/learn-admin`, sign in with your Ramani email, and press Write.

## internal.ramani.io

Add a "Learn editor" link on internal.ramani.io that opens `https://<resources domain>/learn-admin`. Staff sign in once through Access and land in the editor. The editor stays in this repo, so there is one codebase for the blog.
