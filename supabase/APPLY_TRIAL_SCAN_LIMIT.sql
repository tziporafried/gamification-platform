-- Apply trial scan quota + activation reset (safe to re-run)

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

  IF EXISTS (
    SELECT 1 FROM activity_templates WHERE draft_event_id = NEW.event_id
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_profiles WHERE id = v_owner_id AND role = 'super_admin'
  ) THEN
    RETURN NEW;
  END IF;

  IF v_plan = 'organizations' THEN
    RETURN NEW;
  END IF;

  IF v_plan IN ('independent', 'full') THEN
    IF TG_TABLE_NAME = 'participants' THEN
      SELECT COUNT(*) INTO v_count FROM participants WHERE event_id = NEW.event_id;
      IF v_count >= 70 THEN
        RAISE EXCEPTION 'PLAN_LIMIT_REACHED:participants limit is 70 (current: %)', v_count;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS trial_scans_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS trial_runtime_reset_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_trial_scans_used_nonneg'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_trial_scans_used_nonneg CHECK (trial_scans_used >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION check_trial_scan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan TEXT;
  v_used INTEGER;
BEGIN
  SELECT plan, trial_scans_used
  INTO v_plan, v_used
  FROM events
  WHERE id = NEW.event_id;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_plan IS DISTINCT FROM 'free' THEN
    RETURN NEW;
  END IF;

  SELECT plan, trial_scans_used
  INTO v_plan, v_used
  FROM events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF v_plan IS DISTINCT FROM 'free' THEN
    RETURN NEW;
  END IF;

  IF v_used >= 5 THEN
    RAISE EXCEPTION 'TRIAL_SCAN_LIMIT_REACHED:trial scan limit is 5 (current: %)', v_used;
  END IF;

  UPDATE events
  SET trial_scans_used = trial_scans_used + 1,
      updated_at = now()
  WHERE id = NEW.event_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_trial_scan_limit ON point_transactions;

CREATE TRIGGER trg_check_trial_scan_limit
  BEFORE INSERT ON point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_trial_scan_limit();

DROP FUNCTION IF EXISTS update_event_plan(UUID, TEXT);

CREATE OR REPLACE FUNCTION update_event_plan(p_event_id UUID, p_new_plan TEXT)
RETURNS JSONB AS $$
DECLARE
  v_old_plan  TEXT;
  v_used      INTEGER;
  v_reset_at  TIMESTAMPTZ;
  v_did_reset BOOLEAN := false;
BEGIN
  IF p_new_plan NOT IN ('free', 'independent', 'full', 'organizations') THEN
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

  IF v_old_plan = 'free'
     AND p_new_plan IS DISTINCT FROM 'free'
     AND v_reset_at IS NULL
  THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_event_plan(UUID, TEXT) TO authenticated;

UPDATE events e
SET trial_scans_used = sub.cnt
FROM (
  SELECT event_id, LEAST(COUNT(*)::INTEGER, 5) AS cnt
  FROM point_transactions
  GROUP BY event_id
) sub
WHERE e.id = sub.event_id
  AND e.plan = 'free'
  AND e.trial_scans_used = 0
  AND sub.cnt > 0;
