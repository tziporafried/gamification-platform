-- Apply booking package + price + finance link (migration 065)

ALTER TABLE scanner_bookings
  ADD COLUMN IF NOT EXISTS booking_package TEXT
    CHECK (
      booking_package IS NULL
      OR booking_package IN ('independent', 'full', 'offline', 'organizations')
    ),
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2)
    CHECK (amount IS NULL OR amount >= 0),
  ADD COLUMN IF NOT EXISTS finance_entry_id UUID
    REFERENCES admin_finance_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scanner_bookings_finance
  ON scanner_bookings(finance_entry_id)
  WHERE finance_entry_id IS NOT NULL;

COMMENT ON COLUMN scanner_bookings.booking_package IS
  'Commercial package sold with this booking (independent/full/offline/organizations).';
COMMENT ON COLUMN scanner_bookings.amount IS
  'Amount charged for this booking (may differ from list price).';
COMMENT ON COLUMN scanner_bookings.finance_entry_id IS
  'Linked income row in admin_finance_entries, if recorded.';
