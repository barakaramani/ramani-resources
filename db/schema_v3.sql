-- Ramani leads, version 3: email through Amazon SES. Run once after schema_v2.sql.
ALTER TABLE people ADD COLUMN email_consent INTEGER NOT NULL DEFAULT 0;  -- agreed to marketing email
ALTER TABLE people ADD COLUMN email_opt_out INTEGER NOT NULL DEFAULT 0;  -- unsubscribed
ALTER TABLE people ADD COLUMN email_status TEXT;                          -- bounced or complained: never email again
ALTER TABLE people ADD COLUMN lang TEXT;                                  -- en or sw
ALTER TABLE people ADD COLUMN region TEXT;

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, subject TEXT NOT NULL, preheader TEXT, body TEXT NOT NULL, segment TEXT NOT NULL,
  created_by TEXT, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', sent INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS email_sends (
  id TEXT PRIMARY KEY, campaign_id TEXT, person_id TEXT NOT NULL, kind TEXT, status TEXT NOT NULL, at TEXT NOT NULL, message_id TEXT, error TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS one_send_per_campaign ON email_sends(campaign_id, person_id) WHERE campaign_id IS NOT NULL;
