-- The choices in the expense form's Tag dropdown (contract §5.1). Each business has its
-- own list; names are unique per business, ignoring case. An expense still stores its
-- tags in expenses.tags, so search and Analytics don't depend on this table.
CREATE TABLE expense_tags (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_expense_tags_business_name ON expense_tags (business_id, lower(name));

-- Businesses created before this migration get the starter tags that
-- registration gives new ones (ExpenseTagService.STARTER_TAGS).
INSERT INTO expense_tags (business_id, name)
SELECT b.id, starter.name
FROM businesses b
CROSS JOIN (VALUES (1, 'supplier'), (2, 'supplies'), (3, 'rent'), (4, 'utilities'), (5, 'market'))
  AS starter (pos, name)
ORDER BY b.id, starter.pos;

-- A supplier order or a bill (contract §5). Its total isn't stored: it's the sum of its lines.
CREATE TABLE expenses (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  incurred_at TIMESTAMPTZ NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_business_id ON expenses (business_id);
CREATE INDEX idx_expenses_incurred_at ON expenses (incurred_at);

-- An expense's lines: a restock (item_id set; its stock went up by quantity) or a plain
-- cost such as "Rent" (item_id NULL, item_name = the description). The name is copied,
-- so the history survives, and item_id becomes NULL if the item is deleted.
CREATE TABLE expense_items (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expense_id      INTEGER NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
  item_id         INTEGER REFERENCES items (id) ON DELETE SET NULL,
  item_name       TEXT    NOT NULL,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
  total_cents     INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0)
);
CREATE INDEX idx_expense_items_expense_id ON expense_items (expense_id);
CREATE INDEX idx_expense_items_item_id ON expense_items (item_id);
