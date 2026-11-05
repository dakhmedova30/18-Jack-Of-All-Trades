-- Profile details (owner, contact, description, links) and the business logo.
-- All optional, so they start empty. The logo bytes get their own table, like the avatar.
ALTER TABLE businesses
  ADD COLUMN owner_first_name TEXT,
  ADD COLUMN owner_last_name TEXT,
  ADD COLUMN phone TEXT,
  ADD COLUMN address_line TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN region TEXT,
  ADD COLUMN postal_code TEXT,
  ADD COLUMN description TEXT,
  ADD COLUMN website TEXT,
  ADD COLUMN instagram TEXT,
  ADD COLUMN facebook TEXT,
  ADD COLUMN etsy TEXT,
  ADD COLUMN logo_updated_at TIMESTAMPTZ;

CREATE TABLE business_logos (
  business_id  INTEGER PRIMARY KEY REFERENCES businesses (id) ON DELETE CASCADE,
  content_type TEXT  NOT NULL,
  data         BYTEA NOT NULL
);
