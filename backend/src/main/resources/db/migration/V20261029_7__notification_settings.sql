-- Which alerts a business wants, and the numbers that trigger them. A business with no row here
-- gets these defaults (NotificationSettings.DEFAULTS), so nothing needs back-filling.
-- The low-stock number is not here: it is businesses.low_stock_threshold.
CREATE TABLE notification_settings (
  business_id           INTEGER PRIMARY KEY REFERENCES businesses (id) ON DELETE CASCADE,
  low_stock             BOOLEAN NOT NULL DEFAULT TRUE,
  out_of_stock          BOOLEAN NOT NULL DEFAULT TRUE,
  new_device            BOOLEAN NOT NULL DEFAULT TRUE,
  no_sales              BOOLEAN NOT NULL DEFAULT TRUE,
  no_sales_days         INTEGER NOT NULL DEFAULT 3  CHECK (no_sales_days BETWEEN 1 AND 365),
  expense_spike         BOOLEAN NOT NULL DEFAULT TRUE,
  expense_spike_percent INTEGER NOT NULL DEFAULT 20 CHECK (expense_spike_percent BETWEEN 1 AND 1000)
);
