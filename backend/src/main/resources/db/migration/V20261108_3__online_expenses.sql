-- Online Shop expenses (platform fees, shipping, ads...). Each entry has its own currency; the monthly
-- view groups them by month and converts to the currency being displayed.
CREATE TABLE online_expenses (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id  INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  spent_on     DATE        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  category     TEXT        NOT NULL DEFAULT '',
  amount_cents INTEGER     NOT NULL CHECK (amount_cents >= 0),
  currency     CHAR(3)     NOT NULL DEFAULT 'CAD' CHECK (currency IN ('CAD', 'USD', 'EUR', 'GBP', 'AUD')),
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_online_expenses_business_spent_on ON online_expenses (business_id, spent_on);
