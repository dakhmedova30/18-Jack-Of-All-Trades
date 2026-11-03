-- Account settings: business details, and when the owner last logged in.
-- time_zone defaults to UTC because that is what the analytics windows use today.
ALTER TABLE businesses
  ADD COLUMN business_type TEXT,
  ADD COLUMN country       TEXT,
  ADD COLUMN time_zone     TEXT        NOT NULL DEFAULT 'UTC',
  ADD COLUMN currency      TEXT        NOT NULL DEFAULT 'CAD',
  ADD COLUMN last_login_at TIMESTAMPTZ;
