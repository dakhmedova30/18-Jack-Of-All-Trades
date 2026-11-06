ALTER TABLE items
  ADD COLUMN currency VARCHAR(3),
  ADD COLUMN original_price NUMERIC(14, 2),
  ADD COLUMN original_currency VARCHAR(3);

UPDATE items i
SET currency = b.currency,
    original_price = i.unit_price_cents::NUMERIC / 100,
    original_currency = b.currency
FROM businesses b
WHERE b.id = i.business_id;

ALTER TABLE items
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN original_price SET NOT NULL,
  ALTER COLUMN original_currency SET NOT NULL;
ALTER TABLE items
  ALTER COLUMN currency SET DEFAULT 'CAD',
  ALTER COLUMN original_price SET DEFAULT 0,
  ALTER COLUMN original_currency SET DEFAULT 'CAD';

ALTER TABLE sales
  ADD COLUMN currency VARCHAR(3),
  ADD COLUMN original_amount NUMERIC(16, 2),
  ADD COLUMN original_currency VARCHAR(3);

UPDATE sales s
SET currency = b.currency,
    original_amount = COALESCE((
      SELECT SUM(line.total_cents)
      FROM sale_items line
      WHERE line.sale_id = s.id
    ), 0)::NUMERIC / 100,
    original_currency = b.currency
FROM businesses b
WHERE b.id = s.business_id;

ALTER TABLE sales
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN original_amount SET NOT NULL,
  ALTER COLUMN original_currency SET NOT NULL;
ALTER TABLE sales
  ALTER COLUMN currency SET DEFAULT 'CAD',
  ALTER COLUMN original_amount SET DEFAULT 0,
  ALTER COLUMN original_currency SET DEFAULT 'CAD';

ALTER TABLE expenses
  ADD COLUMN currency VARCHAR(3),
  ADD COLUMN original_amount NUMERIC(16, 2),
  ADD COLUMN original_currency VARCHAR(3);

UPDATE expenses e
SET currency = b.currency,
    original_amount = COALESCE((
      SELECT SUM(line.total_cents)
      FROM expense_items line
      WHERE line.expense_id = e.id
    ), 0)::NUMERIC / 100,
    original_currency = b.currency
FROM businesses b
WHERE b.id = e.business_id;

ALTER TABLE expenses
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN original_amount SET NOT NULL,
  ALTER COLUMN original_currency SET NOT NULL;
ALTER TABLE expenses
  ALTER COLUMN currency SET DEFAULT 'CAD',
  ALTER COLUMN original_amount SET DEFAULT 0,
  ALTER COLUMN original_currency SET DEFAULT 'CAD';
