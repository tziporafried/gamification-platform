-- Migration 089: the participant cap follows the flag, not a plan list.
--
-- 088 let `unlimited_participants` lift the 70-participant cap, but kept the
-- plan list that decided who had a cap in the first place: organizations was
-- uncapped by a hardcoded branch, independent / full / offline were capped, and
-- the flag was consulted only for the second group.
--
-- That is two answers to one question. Now that the flag is granted to a
-- product through its own `default_plans` - which is what the admin panel is
-- for - the plan list in here is the copy that goes stale. So the cap asks the
-- flag and nothing else: a game with `unlimited_participants` has no cap,
-- whatever its plan, and a game without it is capped at 70.
--
-- Two things deliberately stay as they were:
--
--   * Trial (`free`) has had no entity cap since 054. It is not in the list
--     below, so the flag is never consulted for it and it stays uncapped.
--   * Template drafts and super-admin-owned games bypass everything, before
--     any of this is reached.
--
-- And one safety valve: until the flag exists in the catalogue, the plans
-- decide exactly as they did before 088. A database that never ran 075/076,
-- or one where nobody has created the flag yet, must not start capping the
-- organizations games that have never had a cap.

-- ============================================================
-- 1. Does this flag exist at all?
-- ============================================================
-- Apart from `event_has_feature`, which answers whether one game has a flag.
-- This answers whether the question is even meaningful yet - the difference
-- between "the catalogue says no" and "there is no catalogue".
--
-- A retired flag (is_active = false) reads as not existing, matching how
-- activeFlags() treats it in the client: retired is history, not a choice.
CREATE OR REPLACE FUNCTION public.feature_flag_exists(p_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF to_regclass('public.feature_flags') IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (SELECT 1 FROM feature_flags WHERE key = p_key AND is_active);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.feature_flag_exists(TEXT) TO authenticated;

-- ============================================================
-- 2. The cap
-- ============================================================
-- Body from 063 / 088, with the plan branches for participants replaced by the
-- flag. Every other plan, table and bypass is untouched.
CREATE OR REPLACE FUNCTION check_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_plan     TEXT;
  v_count    INTEGER;
  v_uncapped BOOLEAN;
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

  -- The participant cap is the only limit any paid plan still has. Groups,
  -- actions and rewards are uncapped everywhere and fall straight through.
  IF TG_TABLE_NAME = 'participants'
     AND v_plan IN ('independent', 'full', 'offline', 'organizations') THEN

    IF public.feature_flag_exists('unlimited_participants') THEN
      v_uncapped := public.event_has_feature(NEW.event_id, 'unlimited_participants');
    ELSE
      -- The flag has not been created yet: the pre-088 plan rule, so nothing
      -- that was uncapped yesterday is capped today.
      v_uncapped := (v_plan = 'organizations');
    END IF;

    IF NOT v_uncapped THEN
      SELECT COUNT(*) INTO v_count FROM participants WHERE event_id = NEW.event_id;
      IF v_count >= 70 THEN
        RAISE EXCEPTION 'PLAN_LIMIT_REACHED:participants limit is 70 (current: %)', v_count;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
