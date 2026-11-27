-- Reusable discounts and charges (flowchart: Discounts & Charges). A sale applies one of
-- these and stores the computed amount as its own line, so editing or deleting a discount
-- never changes past sales.
CREATE TABLE discounts (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id INTEGER       NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name        TEXT          NOT NULL,
  -- An item tag ("type of merch"); NULL means every item.
  applies_to  TEXT,
  kind        TEXT          NOT NULL CHECK (kind IN ('PRESET', 'PER_AMOUNT', 'SOLID')),
  is_charge   BOOLEAN       NOT NULL DEFAULT FALSE,
  value_type  TEXT          CHECK (value_type IN ('AMOUNT', 'PERCENT')),
  value       NUMERIC(12,2) CHECK (value >= 0),
  buy_count   INTEGER       CHECK (buy_count >= 1),
  get_count   INTEGER       CHECK (get_count >= 1),
  currency    CHAR(3)       NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_discounts_business_id ON discounts (business_id);

-- "Per Amount" bundles: buying `item_count` eligible items costs `price_cents` in total.
CREATE TABLE discount_tiers (
  discount_id INTEGER NOT NULL REFERENCES discounts (id) ON DELETE CASCADE,
  item_count  INTEGER NOT NULL CHECK (item_count >= 1),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  PRIMARY KEY (discount_id, item_count)
);
