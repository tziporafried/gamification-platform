-- Phase 27: Replace נופש משפחתי groups with מבוגרים / ילדים / נוער
-- All tasks become available to all groups (no eligibility restrictions).

DO $$
DECLARE
  v_tmpl UUID;
BEGIN

  SELECT id INTO v_tmpl FROM activity_templates WHERE name = 'נופש משפחתי';

  -- Remove all existing group eligibility rows for tasks in this template
  DELETE FROM template_task_groups
  WHERE template_task_id IN (
    SELECT template_task_id FROM activity_template_tasks WHERE activity_template_id = v_tmpl
  );

  -- Remove all existing groups for this template
  DELETE FROM activity_template_groups WHERE activity_template_id = v_tmpl;

  -- Insert the 3 new groups
  INSERT INTO activity_template_groups (activity_template_id, name, color, sort_order) VALUES
    (v_tmpl, 'מבוגרים', '#6366f1', 1),
    (v_tmpl, 'ילדים',   '#10b981', 2),
    (v_tmpl, 'נוער',    '#f59e0b', 3);

  -- No template_task_groups rows inserted → all tasks available to all groups

END $$;
