-- Migration 011: Plan limit enforcement triggers + admin RPCs
-- Free plan limits per event: 10 participants, 2 groups, 3 actions, 3 rewards

-- ============================================================
-- PLAN LIMIT VALIDATION TRIGGER
-- Runs BEFORE INSERT on participants, groups, actions, rewards.
-- Paid users bypass all checks.
-- ============================================================
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

  SELECT plan INTO v_plan
  FROM user_profiles WHERE id = v_owner_id;

  IF v_plan = 'paid' THEN
    RETURN NEW;
  END IF;

  v_table_name := TG_TABLE_NAME;

  IF v_table_name = 'participants' THEN
    v_limit := 10;
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

CREATE TRIGGER check_participants_plan_limit
  BEFORE INSERT ON participants
  FOR EACH ROW EXECUTE FUNCTION check_plan_limit();

CREATE TRIGGER check_groups_plan_limit
  BEFORE INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION check_plan_limit();

CREATE TRIGGER check_actions_plan_limit
  BEFORE INSERT ON actions
  FOR EACH ROW EXECUTE FUNCTION check_plan_limit();

CREATE TRIGGER check_rewards_plan_limit
  BEFORE INSERT ON rewards
  FOR EACH ROW EXECUTE FUNCTION check_plan_limit();

-- ============================================================
-- ADMIN RPC: Update user plan (super_admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION update_user_plan(target_user_id UUID, new_plan TEXT)
RETURNS VOID AS $$
BEGIN
  IF new_plan NOT IN ('free', 'paid') THEN
    RAISE EXCEPTION 'Invalid plan value: %', new_plan;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  UPDATE user_profiles
  SET plan = new_plan, updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ADMIN RPC: Get all users with event info (super_admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT,
  plan TEXT,
  created_at TIMESTAMPTZ,
  event_count BIGINT,
  event_names TEXT
) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    up.id AS user_id,
    up.email,
    up.display_name,
    up.avatar_url,
    up.role,
    up.plan,
    up.created_at,
    COALESCE(ev.cnt, 0) AS event_count,
    COALESCE(ev.names, '') AS event_names
  FROM user_profiles up
  LEFT JOIN (
    SELECT
      owner_admin_id,
      COUNT(*) AS cnt,
      STRING_AGG(name, ', ' ORDER BY created_at DESC) AS names
    FROM events
    GROUP BY owner_admin_id
  ) ev ON ev.owner_admin_id = up.id
  ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
