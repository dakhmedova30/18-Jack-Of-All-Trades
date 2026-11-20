ALTER TABLE expense_items
  ADD COLUMN category TEXT NOT NULL DEFAULT '',
  ADD COLUMN subcategory TEXT NOT NULL DEFAULT '',
  ADD COLUMN manufacturer TEXT NOT NULL DEFAULT '',
  ADD COLUMN line_type TEXT NOT NULL DEFAULT 'other';

UPDATE expense_items
SET line_type = CASE WHEN item_id IS NOT NULL THEN 'product' ELSE 'other' END;

ALTER TABLE expense_items
  ADD CONSTRAINT expense_items_line_type_check
  CHECK (line_type IN ('product', 'shipping', 'fee', 'other'));

CREATE INDEX idx_expense_items_category ON expense_items (category, subcategory);
CREATE INDEX idx_expense_items_manufacturer ON expense_items (manufacturer);
