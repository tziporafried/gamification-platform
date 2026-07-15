-- Migration 058: Physical QR scanners inventory + bookings for full-plan events
-- Super-admin ops calendar: which scanner is out on which dates.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE scanners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'maintenance', 'retired')),
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scanners_status ON scanners(status);
CREATE INDEX idx_scanners_sort ON scanners(sort_order);

CREATE TRIGGER scanners_updated_at
  BEFORE UPDATE ON scanners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TABLE scanner_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scanner_id UUID NOT NULL REFERENCES scanners(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scanner_bookings_valid_range CHECK (end_date >= start_date),
  CONSTRAINT scanner_bookings_no_overlap EXCLUDE USING gist (
    scanner_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
);

CREATE INDEX idx_scanner_bookings_scanner ON scanner_bookings(scanner_id);
CREATE INDEX idx_scanner_bookings_dates ON scanner_bookings(start_date, end_date);

CREATE TRIGGER scanner_bookings_updated_at
  BEFORE UPDATE ON scanner_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE scanners ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanner_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage scanners"
  ON scanners FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can manage scanner bookings"
  ON scanner_bookings FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

INSERT INTO scanners (name, code, sort_order, notes) VALUES
  ('סורק 1', 'SCAN-01', 1, 'מכשיר סריקה למסלול מלא'),
  ('סורק 2', 'SCAN-02', 2, 'מכשיר סריקה למסלול מלא'),
  ('סורק 3', 'SCAN-03', 3, 'מכשיר סריקה למסלול מלא');
