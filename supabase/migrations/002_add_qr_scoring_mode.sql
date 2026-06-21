-- Add QR scoring mode to events
-- Allowed values: 'combined', 'separate'
-- Default: 'combined' (backward compatible)

ALTER TABLE events
  ADD COLUMN qr_scoring_mode TEXT NOT NULL DEFAULT 'combined';
