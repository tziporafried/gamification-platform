-- Migration 050: Apply the 70-participant cap to the "independent" plan too.
-- Previously independent had no limits; now independent and full share the same
-- participant cap (70), with groups/actions/rewards unlimited. Only organizations
-- remains fully unlimited. Redefines check_plan_limit() (last set in migration 049).

CREATE OR REPLACE FUNCTION check_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_plan     TEXT;
  v_count    INTEGER;
  v_limit    INTEGER;
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

  -- free plan: enforce all limits
  IF    TG_TABLE_NAME = 'participants' THEN
    v_limit := 2;
    SELECT COUNT(*) INTO v_count FROM participants WHERE event_id = NEW.event_id;
  ELSIF TG_TABLE_NAME = 'groups' THEN
    v_limit := 3;
    SELECT COUNT(*) INTO v_count FROM groups WHERE event_id = NEW.event_id;
  ELSIF TG_TABLE_NAME = 'actions' THEN
    v_limit := 3;
    SELECT COUNT(*) INTO v_count FROM actions WHERE event_id = NEW.event_id;
  ELSIF TG_TABLE_NAME = 'rewards' THEN
    v_limit := 3;
    SELECT COUNT(*) INTO v_count FROM rewards WHERE event_id = NEW.event_id;
  ELSE
    RETURN NEW;
  END IF;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED:% limit is % for free plan (current: %)',
      TG_TABLE_NAME, v_limit, v_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
