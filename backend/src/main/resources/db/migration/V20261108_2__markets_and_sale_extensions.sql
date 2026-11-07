-- In-person markets, and the extra fields sales need for markets, discounts, tips and trades.

CREATE TABLE markets (
  id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id          INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,
  start_date           DATE        NOT NULL,
  end_date             DATE        NOT NULL,
  location             TEXT        NOT NULL DEFAULT '',
  table_fee_cents      INTEGER     NOT NULL DEFAULT 0 CHECK (table_fee_cents >= 0),
  extra_expenses_cents INTEGER     NOT NULL DEFAULT 0 CHECK (extra_expenses_cents >= 0),
  currency             CHAR(3)     NOT NULL,
  website              TEXT,
  status               TEXT        NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING', 'ACCEPTED', 'WAITLISTED', 'REJECTED')),
  going                TEXT        NOT NULL DEFAULT 'PENDING' CHECK (going IN ('PENDING', 'YES', 'NO')),
  tags                 TEXT[]      NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_markets_business_id ON markets (business_id);

-- A market's sales are normal sales that point at the market. Its sales are removed by
-- MarketService (which puts their stock back) before the market itself is deleted.
ALTER TABLE sales ADD COLUMN market_id INTEGER REFERENCES markets (id);
CREATE INDEX idx_sales_market_id ON sales (market_id);

-- ITEM lines sell an item. DISCOUNT and CHARGE lines hold a computed amount (negative for a
-- discount) and TIP lines a tip, so every existing "sum of the lines" total stays right.
ALTER TABLE sale_items ADD COLUMN kind TEXT NOT NULL DEFAULT 'ITEM'
  CHECK (kind IN ('ITEM', 'DISCOUNT', 'CHARGE', 'TIP'));
ALTER TABLE sale_items ADD COLUMN is_free BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sale_items ADD COLUMN is_trade BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sale_items ADD COLUMN discount_id INTEGER REFERENCES discounts (id) ON DELETE SET NULL;
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_unit_price_cents_check;
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_total_cents_check;
ALTER TABLE sale_items ADD CONSTRAINT sale_items_amounts_check
  CHECK (kind = 'DISCOUNT' OR (unit_price_cents >= 0 AND total_cents >= 0));
