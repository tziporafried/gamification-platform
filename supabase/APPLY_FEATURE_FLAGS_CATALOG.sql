-- Apply on remote if migrations are not auto-run:
--   Supabase SQL editor - paste this file, run once.
--   Run APPLY_EVENT_FEATURES.sql first if you have not already.
-- Idempotent: IF NOT EXISTS + DROP/CREATE policy, safe to re-run.
--
-- Source: migrations/076_feature_flags_catalog.sql
-- Needed by: the "פיצ׳ר פלאגים" tab in the admin panel, where flags are
-- created and attached to products. Until this runs, the tab reports a missing
-- table, no flag can exist, and every game runs on its plan alone.

-- Migration 076: the feature-flag catalogue.
--
-- 075 gave every game a place to record which flags it was sold
-- (event_features). It did not say what flags *exist* - that list lived in the
-- client, so adding one meant a deploy. This table moves the list into the
-- database, where a super admin can add a flag, describe it, and attach it to
-- the products (plans) that include it, without shipping code.
--
-- Code still decides what a flag *does*: a flag nobody reads changes nothing.
-- The two halves meet on `key` - the admin creates `my_flag` here, and the code
-- gates an area on <FeatureGate flag="my_flag">.
--
--   feature_flags   - what flags exist            (this migration)
--   event_features  - which game was sold which   (075)

CREATE TABLE IF NOT EXISTS feature_flags (
  -- Matches the CHECK on event_features.feature_key from 075.
  key           TEXT PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,48}$'),
  label         TEXT NOT NULL CHECK (length(btrim(label)) > 0),
  description   TEXT NOT NULL DEFAULT '',
  -- The products that include this flag with no per-game row. Usually empty:
  -- a flag is normally sold per game rather than bundled into a plan.
  default_plans TEXT[] NOT NULL DEFAULT '{}'
                CHECK (default_plans <@ ARRAY['free', 'independent', 'full', 'organizations', 'offline']),
  -- Retiring a flag without deleting what was sold: an inactive flag resolves
  -- off everywhere and drops out of the per-game panel, but its history stays.
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS feature_flags_updated_at ON feature_flags;
CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Read: any signed-in user. Resolving a game's capabilities needs the plan
-- defaults, so the client cannot work from event_features alone. The catalogue
-- holds no customer data - just the names of things that can be sold.
-- Write: super admin only.
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users can read the flag catalogue" ON feature_flags;
CREATE POLICY "Signed-in users can read the flag catalogue"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admins manage the flag catalogue" ON feature_flags;
CREATE POLICY "Super admins manage the flag catalogue"
  ON feature_flags FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================
-- LINK THE TWO TABLES
-- ============================================================
-- Deleting a flag should take the per-game grants with it, otherwise the games
-- list keeps counting extras nobody can explain.
--
-- NOT VALID on purpose: it enforces the reference for every new and updated
-- row, but skips the one-off check of rows already there. The catalogue shipped
-- empty, so there should be nothing to check - and if some row does predate
-- this, the migration still applies cleanly instead of failing in the SQL
-- editor. Such a row is a key no flag defines, which the client already
-- ignores when it resolves a game's features.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_features_feature_key_fkey'
  ) THEN
    ALTER TABLE event_features
      ADD CONSTRAINT event_features_feature_key_fkey
      FOREIGN KEY (feature_key) REFERENCES feature_flags(key)
      ON UPDATE CASCADE ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_features_feature_key
  ON event_features(feature_key);
