-- Migration 070: per-event barcode symbology (2D QR vs 1D linear)
--
-- Events default to 'qr' (the two-dimensional QR the cards have always used).
-- Setting 'code128' switches the deck to one-dimensional (linear) barcodes.
-- The scanner reads whatever text a card decodes to, so this only governs how
-- cards are *printed*; the choice is admin-only.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS barcode_type TEXT NOT NULL DEFAULT 'qr'
  CHECK (barcode_type IN ('qr', 'code128'));

-- ============================================================
-- Admin-only setter.
-- Super admins have SELECT (010) but no UPDATE on other owners'
-- events, so the change must go through a SECURITY DEFINER RPC -
-- same shape as update_event_plan (055).
-- ============================================================
DROP FUNCTION IF EXISTS update_event_barcode_type(UUID, TEXT);

CREATE OR REPLACE FUNCTION update_event_barcode_type(p_event_id UUID, p_barcode_type TEXT)
RETURNS VOID AS $$
BEGIN
  IF p_barcode_type NOT IN ('qr', 'code128') THEN
    RAISE EXCEPTION 'Invalid barcode_type: %', p_barcode_type;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  UPDATE events
  SET barcode_type = p_barcode_type,
      updated_at = now()
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION update_event_barcode_type(UUID, TEXT) TO authenticated;
