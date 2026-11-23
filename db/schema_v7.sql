-- Ramani Learn blog: posts written in the staff editor (/learn-admin) and read by the public Learn page.
-- Run once in the D1 console (ramani-leads) after schema_v6.sql.
-- doc holds the whole post as JSON (title, html, cover, byline, SEO fields...). The other columns are copies
-- used for fast, safe filtering: the public page only ever reads rows where published = 1 and published_at <= now.
CREATE TABLE IF NOT EXISTS learn_posts (
  id            TEXT PRIMARY KEY,               -- the post link, for example clearing-costs-at-dar
  published     INTEGER NOT NULL DEFAULT 0,     -- 1 = live (or scheduled when published_at is in the future)
  published_at  INTEGER,                        -- milliseconds since 1970, like Date.now()
  updated_at    INTEGER NOT NULL,
  updated_by    TEXT,                           -- staff email from Cloudflare Access
  doc           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS learn_posts_live ON learn_posts(published, published_at);
