ALTER TABLE items
  ADD COLUMN width NUMERIC(10, 2),
  ADD COLUMN height NUMERIC(10, 2),
  ADD COLUMN size_unit VARCHAR(2),
  ADD COLUMN amount_sold INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE items
  ADD CONSTRAINT items_size_unit_check CHECK (size_unit IN ('in', 'cm', 'mm', 'ft')),
  ADD CONSTRAINT items_size_complete_check CHECK (
    (width IS NULL AND height IS NULL AND size_unit IS NULL)
    OR (width IS NOT NULL AND height IS NOT NULL AND size_unit IS NOT NULL)),
  ADD CONSTRAINT items_amount_sold_check CHECK (amount_sold >= 0);

-- Amount sold starts from what past sales already recorded.
UPDATE items i
SET amount_sold = COALESCE((
  SELECT SUM(si.quantity) FROM sale_items si WHERE si.item_id = i.id
), 0);
