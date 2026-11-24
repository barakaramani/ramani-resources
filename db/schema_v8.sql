-- In code rate limiting for the public API (lib/ratelimit.js). Run once in the D1 console (ramani-leads).
-- One row per visitor IP hash, route group and minute; old rows are cleaned up automatically.
CREATE TABLE IF NOT EXISTS rate_limits (
  k         TEXT PRIMARY KEY,   -- group:iphash:minute
  n         INTEGER NOT NULL,
  reset_at  INTEGER NOT NULL    -- milliseconds since 1970 when this window ends
);
CREATE INDEX IF NOT EXISTS rate_limits_reset ON rate_limits(reset_at);
