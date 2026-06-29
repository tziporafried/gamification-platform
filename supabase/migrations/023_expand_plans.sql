-- Migration 023: Expand plan types (free / independent / full / organizations)
-- and update participant limits per plan tier

-- Step 1: Drop old CHECK constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_plan_check;

-- Step 2: Migrate existing 'paid' users → 'full'
UPDATE user_profiles SET plan = 'full' WHERE plan = 'paid';

-- Step 3: Add new CHECK constraint with all 4 values
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_plan_check
  CHECK (plan IN ('free', 'independent', 'full', 'organizations'));

-- Step 4: Update check_plan_limit to enforce per-plan participant limits
--   free         → 2 participants, 3 groups/actions/rewards
--   independent  → unlimited
--   full         → 50 participants, unlimited groups/actions/rewards
--   organizations→ unlimited
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

  -- 'independent' and 'organizations' have no limits
  IF v_plan IN ('independent', 'organizations') THEN
    RETURN NEW;
  END IF;

  v_table_name := TG_TABLE_NAME;

  IF v_plan = 'full' THEN
    -- full plan: only enforce participant cap (50)
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

  -- 'free' plan: enforce all limits
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

-- Step 5: Update update_user_plan RPC to accept all 4 plan values
CREATE OR REPLACE FUNCTION update_user_plan(target_user_id UUID, new_plan TEXT)
RETURNS VOID AS $$
BEGIN
  IF new_plan NOT IN ('free', 'independent', 'full', 'organizations') THEN
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
