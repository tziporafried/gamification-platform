-- Migration 035: Move plan from user_profiles to events
-- Each event now owns its own plan. Users are just accounts.

-- 1. Add plan column to events (defaults to 'free')
ALTER TABLE events
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'independent', 'full', 'organizations'));

-- 2. Seed: copy each event owner's current plan into the event
UPDATE events e
SET plan = (
  SELECT plan FROM user_profiles WHERE id = e.owner_admin_id
);

-- 3. Add event_id to contact_upgrade_requests so requests are tied to a specific event
ALTER TABLE contact_upgrade_requests
  ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- 4. Rewrite check_plan_limit() to read plan from events instead of user_profiles
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

  -- independent and organizations: no limits
  IF v_plan IN ('independent', 'organizations') THEN
    RETURN NEW;
  END IF;

  -- full plan: only participant cap (50)
  IF v_plan = 'full' THEN
    IF TG_TABLE_NAME = 'participants' THEN
      SELECT COUNT(*) INTO v_count FROM participants WHERE event_id = NEW.event_id;
      IF v_count >= 50 THEN
        RAISE EXCEPTION 'PLAN_LIMIT_REACHED:participants limit is 50 for full plan (current: %)', v_count;
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

-- 5. New RPC: update_event_plan (super_admin only)
CREATE OR REPLACE FUNCTION update_event_plan(p_event_id UUID, p_new_plan TEXT)
RETURNS VOID AS $$
BEGIN
  IF p_new_plan NOT IN ('free', 'independent', 'full', 'organizations') THEN
    RAISE EXCEPTION 'Invalid plan value: %', p_new_plan;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  UPDATE events
  SET plan = p_new_plan, updated_at = now()
  WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update get_all_users_admin() — remove plan field (plan is now per-event)
-- Must drop first because the return type changes (plan column removed)
DROP FUNCTION IF EXISTS get_all_users_admin();
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE (
  user_id      UUID,
  email        TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  role         TEXT,
  created_at   TIMESTAMPTZ,
  event_count  BIGINT,
  event_names  TEXT
) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    up.id          AS user_id,
    up.email,
    up.display_name,
    up.avatar_url,
    up.role,
    up.created_at,
    COALESCE(ev.cnt, 0)   AS event_count,
    COALESCE(ev.names, '') AS event_names
  FROM user_profiles up
  LEFT JOIN (
    SELECT
      owner_admin_id,
      COUNT(*) AS cnt,
      STRING_AGG(name || ' [' || plan || ']', ', ' ORDER BY created_at DESC) AS names
    FROM events
    GROUP BY owner_admin_id
  ) ev ON ev.owner_admin_id = up.id
  ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
