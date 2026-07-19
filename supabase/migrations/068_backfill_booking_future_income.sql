-- Migration 068: Align linked finance rows with booking is_paid.
-- Bookings created before future_income had finance rows as income;
-- after is_paid defaulted to false, the UI said "future" while KPIs still
-- counted those rows as received income.

-- Ensure future_income is allowed (safe if 066 already ran).
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

-- Unpaid bookings → future_income
UPDATE admin_finance_entries f
SET entry_type = 'future_income'
FROM scanner_bookings b
WHERE b.finance_entry_id = f.id
  AND b.is_paid = false
  AND f.entry_type = 'income';

-- Paid bookings → income (in case any were left as future)
UPDATE admin_finance_entries f
SET entry_type = 'income'
FROM scanner_bookings b
WHERE b.finance_entry_id = f.id
  AND b.is_paid = true
  AND f.entry_type = 'future_income';
