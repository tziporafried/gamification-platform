-- Migration 088: a flag that lifts the participant cap for one game.
--
-- The 70-participant cap on the independent / full / offline plans lives in
-- check_plan_limit(), a BEFORE INSERT trigger on participants (011, last
-- redefined in 063). A cap enforced in the database cannot be lifted from the
-- client, so the flag has to be read where the cap is decided - here.
--
-- The flag is `unlimited_participants`, created by hand in the admin panel like
-- every other. Until that row exists this changes nothing: an unknown key
-- resolves off, and the cap applies exactly as it does today.
--
-- Two ways a game gets it, the same two the client resolves by:
--   * the flag's default_plans includes the game's plan  - sold with a product
--   * a row in event_features with enabled = true        - sold to one game
-- and an event_features row with enabled = false takes it away again, even
-- from a plan whose default includes it.

-- ============================================================
-- 1. Reading a flag from the database, the way the client does
-- ============================================================
-- Mirrors resolveEventFeatures() in src/lib/eventFeatures.ts: the flag must
-- exist and be active, default_plans sets the baseline, and an event_features
-- row overrides it in either direction.
--
-- SECURITY DEFINER because the caller is a trigger on an insert the operator is
-- allowed to make, but event_features is readable only by that game's owner and
-- super admins - and the answer must not depend on who is inserting. Nothing is
-- returned to the caller but a boolean about a flag, so this exposes no row.
--
-- A database that has never run 075/076 has no tables to read; the answer there
-- is false - no flag exists - not an error that would fail every insert.
CREATE OR REPLACE FUNCTION public.event_has_feature(p_event_id UUID, p_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan     TEXT;
  v_default  BOOLEAN;
  v_override BOOLEAN;
BEGIN
  IF to_regclass('public.feature_flags') IS NULL
     OR to_regclass('public.event_features') IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT plan INTO v_plan FROM events WHERE id = p_event_id;
  IF v_plan IS NULL THEN
    RETURN FALSE;
  END IF;

  -- A missing or retired flag is off everywhere, and an event_features row that
  -- outlived its flag does not bring it back.
  SELECT v_plan = ANY(default_plans) INTO v_default
  FROM feature_flags
  WHERE key = p_key AND is_active;

  IF v_default IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT enabled INTO v_override
  FROM event_features
  WHERE event_id = p_event_id AND feature_key = p_key;

  RETURN COALESCE(v_override, v_default);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.event_has_feature(UUID, TEXT) TO authenticated;

-- ============================================================
-- 2. The cap asks the flag first
-- ============================================================
-- Body carried over verbatim from migration 063, with one condition added to
-- the participants branch. Every other plan, table and bypass is untouched.
CREATE OR REPLACE FUNCTION check_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_plan     TEXT;
  v_count    INTEGER;
BEGIN
  SELECT owner_admin_id, plan INTO v_owner_id, v_plan
  FROM events WHERE id = NEW.event_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Template draft events are admin sandboxes - no plan limits
  IF EXISTS (
    SELECT 1 FROM activity_templates WHERE draft_event_id = NEW.event_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Super admins bypass plan limits
  IF EXISTS (
    SELECT 1 FROM user_profiles WHERE id = v_owner_id AND role = 'super_admin'
  ) THEN
    RETURN NEW;
  END IF;

  -- organizations: no limits
  IF v_plan = 'organizations' THEN
    RETURN NEW;
  END IF;

  -- independent, full and offline plans: participant cap (70), unless this game
  -- was sold the `unlimited_participants` flag. The flag is only ever consulted
  -- for participants, so no other insert pays for the lookup.
  IF v_plan IN ('independent', 'full', 'offline') THEN
    IF TG_TABLE_NAME = 'participants'
       AND NOT public.event_has_feature(NEW.event_id, 'unlimited_participants') THEN
      SELECT COUNT(*) INTO v_count FROM participants WHERE event_id = NEW.event_id;
      IF v_count >= 70 THEN
        RAISE EXCEPTION 'PLAN_LIMIT_REACHED:participants limit is 70 (current: %)', v_count;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- free (trial) plan: no entity insert limits - scan quota is enforced separately
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
