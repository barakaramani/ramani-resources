-- Uliza Ramani on Cloudflare Workers AI: record which AI answered, so the free daily cap can be counted.
-- Run once in the D1 console (ramani-leads) after schema_v5.sql.
ALTER TABLE questions ADD COLUMN answered_by TEXT;
CREATE INDEX IF NOT EXISTS questions_by_day ON questions(asked_at, answered_by);
