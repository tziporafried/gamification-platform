-- Phase 29: Clean up duplicate template data caused by migrations 025/026 running multiple times.
--
-- Root cause: each run of those migrations inserted new template_tasks rows (new UUIDs, same names)
-- and linked them all to the same template, producing hundreds of duplicate tasks.
--
-- Strategy:
--   1. For each template keep only the ONE task link per unique task name (lowest sort_order wins).
--   2. Delete the orphaned template_tasks rows that are no longer referenced.
--   3. Delete duplicate template_rewards rows (keep one per name per template).

-- Step 1: Remove duplicate activity_template_tasks links
--   For each (activity_template_id, task name) group, keep the row with the lowest sort_order.
--   The primary key is (activity_template_id, template_task_id) so we delete by template_task_id.

DELETE FROM activity_template_tasks
WHERE template_task_id NOT IN (
  SELECT DISTINCT ON (att.activity_template_id, tt.name)
    att.template_task_id
  FROM activity_template_tasks att
  JOIN template_tasks tt ON tt.id = att.template_task_id
  ORDER BY att.activity_template_id, tt.name, tt.sort_order ASC, att.template_task_id ASC
);

-- Step 2: Delete orphaned template_tasks (no longer linked to any template)
DELETE FROM template_tasks
WHERE id NOT IN (SELECT template_task_id FROM activity_template_tasks);

-- Step 3: Remove duplicate template_rewards (keep lowest sort_order per name per template)
DELETE FROM template_rewards
WHERE id NOT IN (
  SELECT DISTINCT ON (activity_template_id, name)
    id
  FROM template_rewards
  ORDER BY activity_template_id, name, sort_order ASC, id ASC
);
