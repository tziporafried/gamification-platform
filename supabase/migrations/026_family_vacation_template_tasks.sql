-- Phase 26: Additional tasks for the נופש משפחתי template

DO $$
DECLARE
  v_tmpl UUID;

  -- new task IDs (t21–t27)
  t21 UUID; t22 UUID; t23 UUID; t24 UUID;
  t25 UUID; t26 UUID; t27 UUID;
BEGIN

  SELECT id INTO v_tmpl FROM activity_templates WHERE name = 'נופש משפחתי';

  -- New tasks
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('סידרתי את החצר',                                    20, 21) RETURNING id INTO t21;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('אימנתי את הדודות לריקוד משפחתי לחתונות',           40, 22) RETURNING id INTO t22;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('למדתי דף גמרא',                                     40, 23) RETURNING id INTO t23;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('למדתי 10 משניות',                                   30, 24) RETURNING id INTO t24;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('הכנתי קפה עם לב לסבתא',                            25, 25) RETURNING id INTO t25;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('הכנתי מנה לבת דודה',                               25, 26) RETURNING id INTO t26;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('שחיתי 5 בריכות רצוף',                              35, 27) RETURNING id INTO t27;

  -- Link new tasks to the template
  INSERT INTO activity_template_tasks (activity_template_id, template_task_id, sort_order) VALUES
    (v_tmpl, t21, 21),
    (v_tmpl, t22, 22),
    (v_tmpl, t23, 23),
    (v_tmpl, t24, 24),
    (v_tmpl, t25, 25),
    (v_tmpl, t26, 26),
    (v_tmpl, t27, 27);

  -- Group eligibility
  -- t21: all (no rows)
  -- t22: בחורות, זו"צים
  INSERT INTO template_task_groups VALUES (t22, 'בחורות'), (t22, 'זו"צים');
  -- t23: בחורים
  INSERT INTO template_task_groups VALUES (t23, 'בחורים');
  -- t24: ילדים, בחורים
  INSERT INTO template_task_groups VALUES (t24, 'ילדים'), (t24, 'בחורים');
  -- t25: בחורות, ילדות
  INSERT INTO template_task_groups VALUES (t25, 'בחורות'), (t25, 'ילדות');
  -- t26: בחורות, ילדות
  INSERT INTO template_task_groups VALUES (t26, 'בחורות'), (t26, 'ילדות');
  -- t27: all (no rows)

END $$;
