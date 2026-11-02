-- The quantity at or below which an item counts as low stock. It was a fixed 5 until now,
-- so 5 stays the default.
ALTER TABLE businesses
  ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0);
