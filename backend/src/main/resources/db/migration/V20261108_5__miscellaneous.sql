CREATE TABLE miscellaneous_records (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_miscellaneous_records_business_name ON miscellaneous_records (business_id, name);

ALTER TABLE sales ADD COLUMN misc_id INTEGER REFERENCES miscellaneous_records (id) ON DELETE SET NULL;
CREATE INDEX idx_sales_misc_id ON sales (misc_id);

CREATE TABLE misc_expenses (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id   INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  misc_id       INTEGER REFERENCES miscellaneous_records (id) ON DELETE SET NULL,
  spent_on      DATE        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  category      TEXT        NOT NULL DEFAULT '',
  amount_cents  INTEGER     NOT NULL CHECK (amount_cents >= 0),
  currency      CHAR(3)     NOT NULL DEFAULT 'CAD' CHECK (currency IN ('CAD', 'USD', 'EUR', 'GBP', 'AUD')),
  tags          TEXT[]      NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_misc_expenses_business_misc_date ON misc_expenses (business_id, misc_id, spent_on);
