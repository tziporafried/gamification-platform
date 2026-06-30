-- Drop legacy qr_scoring_mode column if present
ALTER TABLE events DROP COLUMN IF EXISTS qr_scoring_mode;
