-- Phase 31: Bypass plan limits for template draft events and super admins

CREATE OR REPLACE FUNCTION check_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_plan TEXT;
  v_current_count INTEGER;
  v_limit INTEGER;
  v_table_name TEXT;
BEGIN
  SELECT owner_admin_id INTO v_owner_id
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

  SELECT plan INTO v_plan
  FROM user_profiles WHERE id = v_owner_id;

  IF v_plan IN ('independent', 'organizations') THEN
    RETURN NEW;
  END IF;

  v_table_name := TG_TABLE_NAME;

  IF v_plan = 'full' THEN
    IF v_table_name = 'participants' THEN
      v_limit := 50;
      SELECT COUNT(*) INTO v_current_count FROM participants WHERE event_id = NEW.event_id;
      IF v_current_count >= v_limit THEN
        RAISE EXCEPTION 'PLAN_LIMIT_REACHED:% limit is % for full plan (current: %)',
          v_table_name, v_limit, v_current_count;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF v_table_name = 'participants' THEN
    v_limit := 2;
    SELECT COUNT(*) INTO v_current_count FROM participants WHERE event_id = NEW.event_id;
  ELSIF v_table_name = 'groups' THEN
    v_limit := 3;
    SELECT COUNT(*) INTO v_current_count FROM groups WHERE event_id = NEW.event_id;
  ELSIF v_table_name = 'actions' THEN
    v_limit := 3;
    SELECT COUNT(*) INTO v_current_count FROM actions WHERE event_id = NEW.event_id;
  ELSIF v_table_name = 'rewards' THEN
    v_limit := 3;
    SELECT COUNT(*) INTO v_current_count FROM rewards WHERE event_id = NEW.event_id;
  ELSE
    RETURN NEW;
  END IF;

  IF v_current_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED:% limit is % for free plan (current: %)',
      v_table_name, v_limit, v_current_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
