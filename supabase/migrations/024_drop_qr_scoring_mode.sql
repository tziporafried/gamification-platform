-- Remove QR scoring mode column (combined/separate distinction no longer used)
ALTER TABLE events DROP COLUMN IF EXISTS qr_scoring_mode;
