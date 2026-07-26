-- Apply on remote if migrations are not auto-run:
--   Supabase SQL editor - paste this file, run once.
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP/CREATE policy, safe to re-run.
--
-- Source: migrations/075_event_features.sql
-- Needed by: the per-game feature flags in the admin panel (אירועים tab ->
-- game -> פיצ׳ר פלאגים, and the bookings board's game actions). Until this runs the
-- flags panel reports a missing table and every game falls back to its plan
-- defaults - i.e. exactly today's behaviour. The offline player never reads it.

-- Migration 075: per-game feature flags.
--
-- Until now a game's capabilities were derived from its plan alone, so selling
-- one customer "the basic plan plus the lottery" meant either upgrading their
-- whole plan or telling them no. This table holds the exceptions: one row per
-- (game, feature) that has been agreed separately, with the price and a note
-- recording what was agreed.
--
-- The plan stays the baseline. A game with no rows here behaves exactly as it
-- does today; a row overrides the plan default for that one feature, in either
-- direction (grant an extra, or take something away that the plan includes).
--
-- feature_key is deliberately NOT a foreign key or an enum. The catalogue of
-- features lives in the client (src/lib/eventFeatures.ts), because a flag with
-- no code reading it does nothing - shipping a new feature should not need a
-- migration. The CHECK only keeps keys to the slug shape the catalogue uses;
-- keys the client does not recognise are ignored when features are resolved.

CREATE TABLE IF NOT EXISTS event_features (
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  feature_key TEXT NOT NULL CHECK (feature_key ~ '^[a-z][a-z0-9_]{1,48}$'),
  -- true = granted on top of the plan, false = withheld despite the plan.
  enabled     BOOLEAN NOT NULL,
  -- What was agreed with the customer, in the operator's own words.
  note        TEXT,
  -- Agreed add-on price, for the admin's own bookkeeping. Not charged anywhere.
  price_ils   NUMERIC(10, 2) CHECK (price_ils IS NULL OR price_ils >= 0),
  set_by      UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, feature_key)
);

DROP TRIGGER IF EXISTS event_features_updated_at ON event_features;
CREATE TRIGGER event_features_updated_at
  BEFORE UPDATE ON event_features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Read: anyone who can already read the game (owner, collaborator, super
-- admin) - the client has to know which features are on to render the game.
-- Write: super admin only. Granting yourself a paid feature is the whole thing
-- this table must not allow, so there is no owner-side INSERT/UPDATE policy.
--
-- A super admin can write directly (no SECURITY DEFINER RPC needed, unlike
-- update_event_barcode_type in 070) because this is a new table and its policy
-- covers super admins for every command.
ALTER TABLE event_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own event features" ON event_features;
CREATE POLICY "Owners can view own event features"
  ON event_features FOR SELECT
  USING (public.is_event_owner(event_id));

DROP POLICY IF EXISTS "Collaborators can view shared event features" ON event_features;
CREATE POLICY "Collaborators can view shared event features"
  ON event_features FOR SELECT
  USING (
    event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Super admins manage event features" ON event_features;
CREATE POLICY "Super admins manage event features"
  ON event_features FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
