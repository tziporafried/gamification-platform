-- Migration 072: Say whose hands each income landed in, and who splits the pot.
--
-- Bookings created their finance rows with admin_user_id = NULL, so the ledger
-- could show totals but never "how should this be divided". Two additions:
--   1. scanner_bookings.collected_by - the admin the payment goes to, mirrored
--      onto the linked finance rows.
--   2. user_profiles.in_finance_split - which admins the pot is divided between
--      (a company account can collect money without taking a partner's share).

-- ============================================================
-- 1. Booking -> collecting admin
-- ============================================================
ALTER TABLE scanner_bookings
  ADD COLUMN IF NOT EXISTS collected_by UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scanner_bookings_collected_by
  ON scanner_bookings(collected_by)
  WHERE collected_by IS NOT NULL;

COMMENT ON COLUMN scanner_bookings.collected_by IS
  'Admin whose account the payment for this booking lands in. Mirrored onto admin_user_id of the linked finance rows.';

-- Backfill: prefer an admin already set on the linked income row, otherwise
-- assume whoever entered the booking also collected for it (editable in the UI).
UPDATE scanner_bookings b
SET collected_by = f.admin_user_id
FROM admin_finance_entries f
WHERE b.finance_entry_id = f.id
  AND b.collected_by IS NULL
  AND f.admin_user_id IS NOT NULL;

UPDATE scanner_bookings
SET collected_by = created_by
WHERE collected_by IS NULL;

-- Push the attribution onto the linked finance rows (paid portion + debt), so
-- the per-admin split has data for every booking that already exists.
UPDATE admin_finance_entries f
SET admin_user_id = b.collected_by
FROM scanner_bookings b
WHERE f.admin_user_id IS NULL
  AND b.collected_by IS NOT NULL
  AND (f.id = b.finance_entry_id OR f.id = b.debt_finance_entry_id);

-- ============================================================
-- 2. Who the pot is divided between
-- ============================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS in_finance_split BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_profiles.in_finance_split IS
  'Super admin takes an equal share of the finance pot. Off = can still collect and spend, but is owed nothing.';
