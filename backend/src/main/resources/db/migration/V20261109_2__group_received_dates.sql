ALTER TABLE commissions
  ADD COLUMN received_on DATE NOT NULL DEFAULT CURRENT_DATE;

UPDATE commissions
SET received_on = created_at::date;

ALTER TABLE miscellaneous_records
  ADD COLUMN received_on DATE NOT NULL DEFAULT CURRENT_DATE;

UPDATE miscellaneous_records
SET received_on = created_at::date;
