-- Biashara Tanzania community: members, sign in codes, sessions, spaces, posts, comments, likes and reports.
-- Run once in the D1 console (ramani-leads) after schema_v4.sql. Safe to run again.

CREATE TABLE IF NOT EXISTS members (
  id          TEXT PRIMARY KEY,
  person_id   TEXT REFERENCES people(id),       -- the same person as in the leads table
  email       TEXT UNIQUE,
  phone       TEXT UNIQUE,
  name        TEXT NOT NULL,
  business    TEXT,
  city        TEXT,
  imports     TEXT,                              -- what they import
  years       TEXT,                              -- how long they have been importing
  bio         TEXT,
  role        TEXT NOT NULL DEFAULT 'member',    -- member, mod, admin
  status      TEXT NOT NULL DEFAULT 'active',    -- active, banned
  lang        TEXT,
  created_at  TEXT NOT NULL,
  last_seen   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS members_by_name ON members(name);

-- One time sign in codes, stored as a hash. A code works for 10 minutes and 5 tries.
CREATE TABLE IF NOT EXISTS auth_codes (
  id          TEXT PRIMARY KEY,
  channel     TEXT NOT NULL,                     -- email or sms
  target      TEXT NOT NULL,                     -- the email or +255 phone
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_codes_by_target ON auth_codes(target, created_at);

-- Signed in browsers. Only a hash of the cookie is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL REFERENCES members(id),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_member ON sessions(member_id);

CREATE TABLE IF NOT EXISTS spaces (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name_en     TEXT NOT NULL,
  name_sw     TEXT NOT NULL,
  desc_en     TEXT,
  desc_sw     TEXT,
  emoji       TEXT,
  kind        TEXT NOT NULL DEFAULT 'posts',     -- posts (chat rooms come in round 2)
  staff_only  INTEGER NOT NULL DEFAULT 0,        -- 1: only mods and admins can post (announcements)
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id            TEXT PRIMARY KEY,
  space_id      TEXT NOT NULL REFERENCES spaces(id),
  member_id     TEXT NOT NULL REFERENCES members(id),
  title         TEXT,
  body          TEXT NOT NULL,
  image_key     TEXT,
  pinned        INTEGER NOT NULL DEFAULT 0,
  hidden        INTEGER NOT NULL DEFAULT 0,
  like_count    INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  edited_at     TEXT
);
CREATE INDEX IF NOT EXISTS posts_by_space ON posts(space_id, pinned, created_at);
CREATE INDEX IF NOT EXISTS posts_by_member ON posts(member_id, created_at);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES posts(id),
  member_id   TEXT NOT NULL REFERENCES members(id),
  body        TEXT NOT NULL,
  hidden      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_by_post ON comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS likes (
  post_id     TEXT NOT NULL REFERENCES posts(id),
  member_id   TEXT NOT NULL REFERENCES members(id),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (post_id, member_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,                     -- post or comment
  target_id   TEXT NOT NULL,
  member_id   TEXT NOT NULL REFERENCES members(id),
  reason      TEXT,
  resolved    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  UNIQUE (kind, target_id, member_id)
);

INSERT OR IGNORE INTO spaces (id, slug, name_en, name_sw, desc_en, desc_sw, emoji, staff_only, sort) VALUES
 ('sp_welcome', 'welcome', 'Welcome and introductions', 'Karibu na utambulisho', 'Say hello: who you are, what you import and what you want to learn.', 'Sema habari: wewe ni nani, unaagiza nini na unataka kujifunza nini.', '👋', 0, 1),
 ('sp_news', 'announcements', 'Announcements', 'Matangazo', 'News from Ramani: meetups, new tools, courses and port updates.', 'Habari kutoka Ramani: mikutano, zana mpya, kozi na taarifa za bandari.', '📣', 1, 2),
 ('sp_china', 'china-sourcing', 'China sourcing', 'Kununua China', 'Suppliers, samples, Canton Fair, 1688 and Alibaba, and paying safely.', 'Wasambazaji, sampuli, Canton Fair, 1688 na Alibaba, na kulipa kwa usalama.', '🏭', 0, 3),
 ('sp_clear', 'clearing', 'Clearing at Dar', 'Kutoa mzigo Dar', 'TRA, TBS, port charges, free days and clearing agents.', 'TRA, TBS, gharama za bandari, siku za bure na mawakala wa forodha.', '⚓', 0, 4),
 ('sp_ship', 'shipping', 'Shipping and cargo', 'Usafirishaji na mizigo', 'Shared loads, full containers, cargo agents and rates.', 'Mizigo ya pamoja, makontena, mawakala wa mizigo na bei.', '🚢', 0, 5),
 ('sp_cash', 'money', 'Money and finance', 'Pesa na ufadhili', 'Cash flow, paying suppliers, the dollar and import finance.', 'Mtiririko wa pesa, kulipa wasambazaji, dola na ufadhili wa uagizaji.', '💵', 0, 6),
 ('sp_sell', 'selling', 'Selling and wholesale', 'Kuuza na jumla', 'Pricing, buyers, Kariakoo and upcountry sales.', 'Bei, wanunuzi, Kariakoo na mauzo ya mikoani.', '🛒', 0, 7),
 ('sp_wins', 'wins', 'Wins', 'Mafanikio', 'Share a win, big or small: a first container, a good supplier, a new buyer.', 'Shiriki mafanikio, makubwa au madogo: kontena la kwanza, msambazaji mzuri, mnunuzi mpya.', '🏆', 0, 8);
