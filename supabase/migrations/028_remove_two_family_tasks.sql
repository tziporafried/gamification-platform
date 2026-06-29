-- Phase 28: Remove two tasks from the נופש משפחתי template.
-- Deleting from template_tasks cascades to activity_template_tasks and template_task_groups.

DELETE FROM template_tasks
WHERE name IN (
  'לקחתי טרמפ לסיבוב ביישוב עם סבא ובני דודים',
  'התקשרתי לסבא וסבתא לפני חג לאחל חג שמח'
);
