-- Apply manually in Supabase SQL editor if migrations are applied outside CLI.
-- Same content as migrations/093_site_settings.sql

-- Migration 093: site-wide settings a super admin changes without a deploy.
--
-- First use: which homepage `/` shows (key 'active_home_page', value = the
-- homepage id from src/pages/home/homePages.ts). No row = the code default.
--
-- Read: everyone, including signed-out visitors - the homepage needs it.
-- The table holds no customer data. Write: super admin only.

CREATE TABLE IF NOT EXISTS site_settings (
  key         TEXT PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  value       TEXT,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS site_settings_updated_at ON site_settings;
CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read site settings" ON site_settings;
CREATE POLICY "Anyone can read site settings"
  ON site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admins manage site settings" ON site_settings;
CREATE POLICY "Super admins manage site settings"
  ON site_settings FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT ON site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON site_settings TO authenticated;
