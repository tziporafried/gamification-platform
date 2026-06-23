-- Migration 018: Ensure event-logos bucket is public
-- Fixes cases where the bucket was created without public=true
-- (ON CONFLICT DO NOTHING in 016 would have skipped the update)

INSERT INTO storage.buckets (id, name, public)
  VALUES ('event-logos', 'event-logos', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
