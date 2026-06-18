-- Phase 1: Events table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Event status enum
CREATE TYPE event_status AS ENUM ('draft', 'active', 'finished', 'archived');

-- Events table
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo_url TEXT,
  theme_color TEXT NOT NULL DEFAULT '#6366f1',
  status event_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One event per admin
CREATE UNIQUE INDEX idx_events_owner ON events(owner_admin_id);

-- Unique slugs
CREATE UNIQUE INDEX idx_events_slug ON events(slug);

-- Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own event"
  ON events FOR SELECT
  USING (auth.uid() = owner_admin_id);

CREATE POLICY "Admins can create own event"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = owner_admin_id);

CREATE POLICY "Admins can update own event"
  ON events FOR UPDATE
  USING (auth.uid() = owner_admin_id)
  WITH CHECK (auth.uid() = owner_admin_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Storage: run these separately in the SQL Editor
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('event-logos', 'event-logos', true);
--
-- CREATE POLICY "Authenticated users can upload logos"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'event-logos' AND auth.role() = 'authenticated');
--
-- CREATE POLICY "Authenticated users can update own logos"
--   ON storage.objects FOR UPDATE
--   USING (bucket_id = 'event-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- CREATE POLICY "Public logo access"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'event-logos');
