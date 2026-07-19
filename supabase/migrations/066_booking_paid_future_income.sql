-- Migration 066: Booking paid flag + future_income finance type

ALTER TABLE admin_finance_entries
  DROP CONSTRAINT IF EXISTS admin_finance_entries_entry_type_check;

ALTER TABLE admin_finance_entries
  ADD CONSTRAINT admin_finance_entries_entry_type_check
  CHECK (entry_type IN ('income', 'expense', 'future_income'));

ALTER TABLE admin_finance_entries
  DROP CONSTRAINT IF EXISTS admin_finance_expense_requires_admin;

ALTER TABLE admin_finance_entries
  ADD CONSTRAINT admin_finance_expense_requires_admin
  CHECK (entry_type IN ('income', 'future_income') OR admin_user_id IS NOT NULL);

ALTER TABLE scanner_bookings
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN scanner_bookings.is_paid IS
  'True when payment was received. False → linked finance row is future_income.';
