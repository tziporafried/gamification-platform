-- Phase 32: RPC to seed template draft events + reliable plan-limit bypass

CREATE OR REPLACE FUNCTION check_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_plan TEXT;
  v_current_count INTEGER;
  v_limit INTEGER;
  v_table_name TEXT;
BEGIN
  -- Set by seed_template_draft_event during admin template editing
  IF current_setting('app.seed_template_draft', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT owner_admin_id INTO v_owner_id
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

CREATE OR REPLACE FUNCTION seed_template_draft_event(p_template_id UUID, p_event_id UUID)
RETURNS VOID AS $$
DECLARE
  v_template activity_templates%ROWTYPE;
  v_group RECORD;
  v_task RECORD;
  v_reward RECORD;
  v_group_name_to_id JSONB := '{}'::jsonb;
  v_action_id UUID;
  v_group_id UUID;
  v_eligible_name TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = p_event_id AND e.owner_admin_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Event not found or not owned by caller';
  END IF;

  SELECT * INTO v_template FROM activity_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  UPDATE activity_templates
  SET draft_event_id = p_event_id
  WHERE id = p_template_id;

  PERFORM set_config('app.seed_template_draft', 'true', true);

  DELETE FROM action_groups
  WHERE action_id IN (SELECT id FROM actions WHERE event_id = p_event_id);

  DELETE FROM actions WHERE event_id = p_event_id;
  DELETE FROM groups WHERE event_id = p_event_id;
  DELETE FROM rewards WHERE event_id = p_event_id;

  IF v_template.group_type = 'custom' THEN
    FOR v_group IN
      SELECT name, color
      FROM activity_template_groups
      WHERE activity_template_id = p_template_id
      ORDER BY sort_order
    LOOP
      INSERT INTO groups (event_id, name, color)
      VALUES (p_event_id, v_group.name, v_group.color)
      RETURNING id INTO v_group_id;

      v_group_name_to_id := v_group_name_to_id || jsonb_build_object(v_group.name, v_group_id);
    END LOOP;
  END IF;

  FOR v_task IN
    SELECT tt.id, tt.name, tt.points, tt.description, tt.max_completions
    FROM activity_template_tasks att
    JOIN template_tasks tt ON tt.id = att.template_task_id
    WHERE att.activity_template_id = p_template_id
    ORDER BY att.sort_order
  LOOP
    INSERT INTO actions (event_id, name, points, description, max_completions)
    VALUES (p_event_id, v_task.name, v_task.points, v_task.description, v_task.max_completions)
    RETURNING id INTO v_action_id;

    FOR v_eligible_name IN
      SELECT ttg.group_name
      FROM template_task_groups ttg
      WHERE ttg.template_task_id = v_task.id
    LOOP
      v_group_id := (v_group_name_to_id ->> v_eligible_name)::uuid;
      IF v_group_id IS NOT NULL THEN
        INSERT INTO action_groups (action_id, group_id)
        VALUES (v_action_id, v_group_id);
      END IF;
    END LOOP;
  END LOOP;

  FOR v_reward IN
    SELECT name, required_points
    FROM template_rewards
    WHERE activity_template_id = p_template_id
    ORDER BY sort_order
  LOOP
    INSERT INTO rewards (event_id, name, required_points)
    VALUES (p_event_id, v_reward.name, v_reward.required_points);
  END LOOP;

  PERFORM set_config('app.seed_template_draft', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION seed_template_draft_event(UUID, UUID) TO authenticated;
