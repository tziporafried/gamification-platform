-- Phase 33: Remove duplicate template rewards and harden seed RPC

DELETE FROM template_rewards a
USING template_rewards b
WHERE a.activity_template_id = b.activity_template_id
  AND a.name = b.name
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_rewards_template_name
  ON template_rewards (activity_template_id, name);

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
    SELECT DISTINCT ON (name) name, required_points
    FROM template_rewards
    WHERE activity_template_id = p_template_id
    ORDER BY name, sort_order
  LOOP
    INSERT INTO rewards (event_id, name, required_points)
    VALUES (p_event_id, v_reward.name, v_reward.required_points);
  END LOOP;

  PERFORM set_config('app.seed_template_draft', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
