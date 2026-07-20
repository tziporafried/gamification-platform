-- Migration 054: Trial mode = build freely, cap trial scans only.
--
-- 1) Remove free-plan entity limits (groups / participants / actions / rewards).
--    Paid plans keep the existing 70-participant cap for independent/full.
-- 2) Enforce a hard limit of 5 point_transactions per free (trial) event,
--    with row lock on events to prevent concurrent inserts from racing past 5.

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

  -- independent and full plans: participant cap (70); everything else unlimited
  IF v_plan IN ('independent', 'full') THEN
    IF TG_TABLE_NAME = 'participants' THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_trial_scan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan  TEXT;
  v_count INTEGER;
BEGIN
  SELECT plan INTO v_plan
  FROM events
  WHERE id = NEW.event_id;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Only trial (free) events are capped - avoid locking paid/org events
  IF v_plan IS DISTINCT FROM 'free' THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent score inserts for this trial event
  SELECT plan INTO v_plan
  FROM events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF v_plan IS DISTINCT FROM 'free' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM point_transactions
  WHERE event_id = NEW.event_id;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'TRIAL_SCAN_LIMIT_REACHED:trial scan limit is 5 (current: %)', v_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_trial_scan_limit ON point_transactions;

CREATE TRIGGER trg_check_trial_scan_limit
  BEFORE INSERT ON point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_trial_scan_limit();
