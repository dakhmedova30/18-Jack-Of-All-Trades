CREATE TABLE commissions (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  contact     TEXT        NOT NULL DEFAULT '',
  request     TEXT        NOT NULL DEFAULT '',
  deadline    DATE        NOT NULL,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_commissions_business_deadline ON commissions (business_id, deadline);

ALTER TABLE sales ADD COLUMN commission_id INTEGER REFERENCES commissions (id) ON DELETE SET NULL;
CREATE INDEX idx_sales_commission_id ON sales (commission_id);

CREATE TABLE commission_expenses (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id  INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  commission_id INTEGER REFERENCES commissions (id) ON DELETE SET NULL,
  spent_on     DATE        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  category     TEXT        NOT NULL DEFAULT '',
  amount_cents INTEGER     NOT NULL CHECK (amount_cents >= 0),
  currency     CHAR(3)     NOT NULL DEFAULT 'CAD' CHECK (currency IN ('CAD', 'USD', 'EUR', 'GBP', 'AUD')),
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_commission_expenses_business_commission_date
  ON commission_expenses (business_id, commission_id, spent_on);
