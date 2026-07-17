-- Migration 063: add the 'offline' plan.
--
-- Same product as 'full' — same 70-participant cap, same live scanning — the
-- only difference is delivery: the game is exported to a self-contained file and
-- handed to the customer, so it runs with no network at the venue. There is no
-- self-service download; a super admin sends the file after a plan-offline
-- request.
--
-- Everywhere a plan is judged, 'offline' must behave exactly like 'full'.
--
-- NOTE: both functions below re-declare `SET search_path = public, pg_temp`.
-- Migration 062 pinned it with ALTER FUNCTION, but CREATE OR REPLACE rewrites a
-- function's settings wholesale — omitting the clause here would silently strip
-- that hardening off these two SECURITY DEFINER functions.

-- ─── 1. Allow the new value ──────────────────────────────────────────────────
-- The CHECK from migration 035 was unnamed, so Postgres called it
-- events_plan_check; re-add it named so it can be found next time.
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_plan_check;

ALTER TABLE events
  ADD CONSTRAINT events_plan_check
  CHECK (plan IN ('free', 'independent', 'full', 'organizations', 'offline'));

-- ─── 2. Entity limits: 'offline' caps participants exactly like 'full' ───────
-- Body carried over verbatim from migration 054, with 'offline' added to the
-- independent/full branch.
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

  -- Template draft events are admin sandboxes — no plan limits
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

  -- independent, full and offline plans: participant cap (70); everything else unlimited
  IF v_plan IN ('independent', 'full', 'offline') THEN
    IF TG_TABLE_NAME = 'participants' THEN
      SELECT COUNT(*) INTO v_count FROM participants WHERE event_id = NEW.event_id;
      IF v_count >= 70 THEN
        RAISE EXCEPTION 'PLAN_LIMIT_REACHED:participants limit is 70 (current: %)', v_count;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- free (trial) plan: no entity insert limits — scan quota is enforced separately
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ─── 3. Let a super admin activate an event onto the offline plan ────────────
-- Body carried over verbatim from migration 055, with 'offline' added to the
-- accepted values. The trial→paid runtime wipe applies to it like any other
-- paid plan.
CREATE OR REPLACE FUNCTION update_event_plan(p_event_id UUID, p_new_plan TEXT)
RETURNS JSONB AS $$
DECLARE
  v_old_plan   TEXT;
  v_used       INTEGER;
  v_reset_at   TIMESTAMPTZ;
  v_did_reset  BOOLEAN := false;
BEGIN
  IF p_new_plan NOT IN ('free', 'independent', 'full', 'organizations', 'offline') THEN
    RAISE EXCEPTION 'Invalid plan value: %', p_new_plan;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  SELECT plan, trial_scans_used, trial_runtime_reset_at
  INTO v_old_plan, v_used, v_reset_at
  FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF v_old_plan IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- First transition trial → real activation: wipe runtime scores/rewards once
  IF v_old_plan = 'free'
     AND p_new_plan IS DISTINCT FROM 'free'
     AND v_reset_at IS NULL
  THEN
    -- Bypass immutability triggers for transactional wipe only
    SET LOCAL session_replication_role = replica;

    DELETE FROM participant_rewards
    WHERE event_id = p_event_id;

    DELETE FROM point_transactions
    WHERE event_id = p_event_id;

    SET LOCAL session_replication_role = DEFAULT;

    UPDATE events
    SET plan = p_new_plan,
        trial_runtime_reset_at = now(),
        updated_at = now()
    WHERE id = p_event_id;

    v_did_reset := true;
  ELSE
    UPDATE events
    SET plan = p_new_plan,
        updated_at = now()
    WHERE id = p_event_id;
  END IF;

  RETURN jsonb_build_object(
    'previous_plan', v_old_plan,
    'new_plan', p_new_plan,
    'did_reset', v_did_reset,
    'trial_scans_used', v_used
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION update_event_plan(UUID, TEXT) TO authenticated;
