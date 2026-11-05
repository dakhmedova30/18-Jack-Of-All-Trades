-- Where a sale happened (contract §4.1). Each business has its own list;
-- names are unique per business, ignoring case.
CREATE TABLE channels (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_channels_business_name ON channels (business_id, lower(name));

-- Businesses created before this migration get the starter channels that
-- registration gives new ones (ChannelService.STARTER_CHANNELS).
INSERT INTO channels (business_id, name)
SELECT b.id, starter.name
FROM businesses b
CROSS JOIN (VALUES (1, 'In person'), (2, 'Online'), (3, 'Commission'), (4, 'Misc')) AS starter (pos, name)
ORDER BY b.id, starter.pos;

-- One checkout (contract §4). Its total isn't stored: it's the sum of its lines.
CREATE TABLE sales (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  sold_at     TIMESTAMPTZ NOT NULL,
  channel_id  INTEGER     NOT NULL REFERENCES channels (id),
  description TEXT        NOT NULL DEFAULT '',
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_business_id ON sales (business_id);
CREATE INDEX idx_sales_sold_at ON sales (sold_at);

-- A sale's lines. Name and price are copied at sale time, so the history
-- survives later price changes, and item_id becomes NULL if the item is deleted.
CREATE TABLE sale_items (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_id          INTEGER NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
  item_id          INTEGER REFERENCES items (id) ON DELETE SET NULL,
  item_name        TEXT    NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  total_cents      INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0)
);
CREATE INDEX idx_sale_items_sale_id ON sale_items (sale_id);
CREATE INDEX idx_sale_items_item_id ON sale_items (item_id);
