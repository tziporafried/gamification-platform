-- Apply manually in Supabase SQL editor.
-- Same content as migrations/069_booking_partial_payment_debt.sql

ALTER TABLE scanner_bookings
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2)
    CHECK (amount_paid IS NULL OR amount_paid >= 0);

ALTER TABLE scanner_bookings
  ADD COLUMN IF NOT EXISTS debt_finance_entry_id UUID
    REFERENCES admin_finance_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scanner_bookings_debt_finance
  ON scanner_bookings(debt_finance_entry_id)
  WHERE debt_finance_entry_id IS NOT NULL;

COMMENT ON COLUMN scanner_bookings.amount_paid IS
  'Amount received so far. Remainder (amount - amount_paid) is debt / future_income.';
COMMENT ON COLUMN scanner_bookings.debt_finance_entry_id IS
  'Linked future_income row for unpaid remainder, if any.';

UPDATE scanner_bookings
SET amount_paid = CASE
  WHEN is_paid AND amount IS NOT NULL THEN amount
  ELSE 0
END
WHERE amount_paid IS NULL;
