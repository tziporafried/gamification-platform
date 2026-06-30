-- Remove unused theme_color column (app uses fixed brand accent)
ALTER TABLE events DROP COLUMN IF EXISTS theme_color;
