-- One row per successful login or registration, for the "Recent login activity" list.
-- Only the newest few per business are kept (AccountSecurityService trims the rest).
CREATE TABLE login_events (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id  INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent   TEXT
);

CREATE INDEX login_events_business_idx ON login_events (business_id, logged_in_at DESC);
