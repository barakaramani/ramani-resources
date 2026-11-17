-- Ramani leads, version 2: MQL score, stage and owner on each person; calls and SMS from SemaCall; site questions.
-- Run once on an existing database: npx wrangler d1 execute ramani-leads --remote --file=schema_v2.sql
ALTER TABLE people ADD COLUMN mql_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE people ADD COLUMN stage TEXT NOT NULL DEFAULT 'lead';      -- lead, MQL, SQL, application, customer, lost
ALTER TABLE people ADD COLUMN owner_bdm TEXT;
ALTER TABLE people ADD COLUMN opt_out INTEGER NOT NULL DEFAULT 0;      -- replied STOP: no marketing SMS

CREATE TABLE IF NOT EXISTS calls (
  id            TEXT PRIMARY KEY,
  person_id     TEXT REFERENCES people(id),
  channel       TEXT NOT NULL,         -- call or sms
  direction     TEXT,
  bdm           TEXT,
  at            TEXT NOT NULL,
  duration      INTEGER,
  recording_url TEXT,
  transcript    TEXT,
  summary       TEXT,
  outcome       TEXT,                  -- interested, call_back, not_now, not_a_fit, no_answer, question, stop
  next_step     TEXT,
  next_date     TEXT,
  objections    TEXT,                  -- JSON list
  sms_draft     TEXT,
  sms_status    TEXT,                  -- draft, sent, skipped
  external_id   TEXT,
  raw           TEXT
);
CREATE INDEX IF NOT EXISTS calls_by_person ON calls(person_id, at);

CREATE TABLE IF NOT EXISTS questions (
  id        TEXT PRIMARY KEY,
  asked_at  TEXT NOT NULL,
  page      TEXT,
  lang      TEXT,
  question  TEXT NOT NULL
);
