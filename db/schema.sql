-- Ramani leads: one row per person, matched by email OR phone.
-- Run once: npx wrangler d1 execute ramani-leads --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS people (
  id           TEXT PRIMARY KEY,
  name         TEXT,
  email        TEXT UNIQUE,          -- lower case
  phone        TEXT UNIQUE,          -- +255XXXXXXXXX
  referred     INTEGER NOT NULL DEFAULT 0,  -- 1 when an agent or bank referred them
  first_type   TEXT,
  first_page   TEXT,
  first_seen   TEXT NOT NULL,
  last_seen    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id           TEXT PRIMARY KEY,
  person_id    TEXT NOT NULL REFERENCES people(id),
  type         TEXT NOT NULL,
  action_key   TEXT,                 -- set for one time actions (newsletter, community_join, download:item ...)
  page         TEXT,
  received_at  TEXT NOT NULL,
  data         TEXT NOT NULL         -- the submitted JSON
);

-- The same person can only do a one time action once.
CREATE UNIQUE INDEX IF NOT EXISTS one_action_per_person ON submissions(person_id, action_key) WHERE action_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS submissions_by_type ON submissions(type, received_at);
