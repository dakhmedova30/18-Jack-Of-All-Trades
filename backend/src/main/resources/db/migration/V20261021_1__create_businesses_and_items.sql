-- One account = one business (contract §2).
CREATE TABLE businesses (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,           -- stored lowercased
  password_hash TEXT        NOT NULL,                  -- BCrypt
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id      INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  quantity         INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price_cents INTEGER     NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  tags             TEXT[]      NOT NULL DEFAULT '{}',
  note             TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_business_id ON items (business_id);
CREATE INDEX idx_items_name ON items (name);
