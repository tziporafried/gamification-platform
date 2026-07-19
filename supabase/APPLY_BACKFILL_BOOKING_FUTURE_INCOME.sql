-- Apply manually in Supabase SQL editor.
-- Same content as migrations/068_backfill_booking_future_income.sql
--
-- Fixes: unpaid bookings showing as "future" while linked finance rows
-- were still counted under סה״כ הכנסות.

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

UPDATE admin_finance_entries f
SET entry_type = 'future_income'
FROM scanner_bookings b
WHERE b.finance_entry_id = f.id
  AND b.is_paid = false
  AND f.entry_type = 'income';

UPDATE admin_finance_entries f
SET entry_type = 'income'
FROM scanner_bookings b
WHERE b.finance_entry_id = f.id
  AND b.is_paid = true
  AND f.entry_type = 'future_income';
