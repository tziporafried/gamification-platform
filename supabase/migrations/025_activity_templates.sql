-- Phase 25: Activity Templates
-- Pre-seeded templates that bootstrap groups, tasks, and rewards for new events.
-- template_task_groups stores eligible group names (matched by name at apply time).
-- Empty = task available to all groups (mirrors the action_groups convention).

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE activity_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL CHECK (group_type IN ('none', 'custom')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activity_template_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_template_id UUID REFERENCES activity_templates(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE template_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT,
  max_completions INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Group eligibility for template tasks (group_name matched by name at apply time).
-- No rows for a task = available to all groups.
CREATE TABLE template_task_groups (
  template_task_id UUID REFERENCES template_tasks(id) ON DELETE CASCADE NOT NULL,
  group_name TEXT NOT NULL,
  PRIMARY KEY (template_task_id, group_name)
);

CREATE TABLE activity_template_tasks (
  activity_template_id UUID REFERENCES activity_templates(id) ON DELETE CASCADE NOT NULL,
  template_task_id UUID REFERENCES template_tasks(id) ON DELETE CASCADE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (activity_template_id, template_task_id)
);

-- Threshold-based rewards seeded with each template.
CREATE TABLE template_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_template_id UUID REFERENCES activity_templates(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  required_points INTEGER NOT NULL CHECK (required_points > 0),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_template_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activity templates"
  ON activity_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Super admin can manage activity templates"
  ON activity_templates FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Authenticated users can view template groups"
  ON activity_template_groups FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Super admin can manage template groups"
  ON activity_template_groups FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Authenticated users can view template tasks"
  ON template_tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Super admin can manage template tasks"
  ON template_tasks FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Authenticated users can view template task groups"
  ON template_task_groups FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Super admin can manage template task groups"
  ON template_task_groups FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Authenticated users can view template task links"
  ON activity_template_tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Super admin can manage template task links"
  ON activity_template_tasks FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Authenticated users can view template rewards"
  ON template_rewards FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Super admin can manage template rewards"
  ON template_rewards FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ============================================================
-- SEED: נופש משפחתי
-- ============================================================

DO $$
DECLARE
  v_tmpl UUID;

  -- group IDs
  g_israelis  UUID; g_ashkenazis UUID;
  g_dodim     UUID; g_dodot      UUID; g_zuzim    UUID;
  g_bachurot  UUID; g_yeladim    UUID; g_bachurim UUID; g_yeladot  UUID;

  -- task IDs (t1–t20)
  t1  UUID; t2  UUID; t3  UUID; t4  UUID; t5  UUID;
  t6  UUID; t7  UUID; t8  UUID; t9  UUID; t10 UUID;
  t11 UUID; t12 UUID; t13 UUID; t14 UUID; t15 UUID;
  t16 UUID; t17 UUID; t18 UUID; t19 UUID; t20 UUID;
BEGIN

  -- Template
  INSERT INTO activity_templates (name, description, group_type, sort_order)
  VALUES (
    'נופש משפחתי',
    'תבנית מוכנה לנופש משפחתי הכוללת קבוצות, משימות ופרסי ניקוד.',
    'custom', 1
  )
  RETURNING id INTO v_tmpl;

  -- Groups
  INSERT INTO activity_template_groups (activity_template_id, name, color, sort_order) VALUES (v_tmpl, 'משפחת ישראלי', '#6366f1', 1) RETURNING id INTO g_israelis;
  INSERT INTO activity_template_groups (activity_template_id, name, color, sort_order) VALUES (v_tmpl, 'משפחת אשכנזי', '#ec4899', 2) RETURNING id INTO g_ashkenazis;
  INSERT INTO activity_template_groups (activity_template_id, name, color, sort_order) VALUES (v_tmpl, 'דודים',         '#f59e0b', 3) RETURNING id INTO g_dodim;
  INSERT INTO activity_template_groups (activity_template_id, name, color, sort_order) VALUES (v_tmpl, 'דודות',         '#10b981', 4) RETURNING id INTO g_dodot;
  INSERT INTO activity_template_groups (activity_template_id, name, color, sort_order) VALUES (v_tmpl, 'זו"צים',        '#3b82f6', 5) RETURNING id INTO g_zuzim;
  INSERT INTO activity_template_groups (activity_template_id, name, color, sort_order) VALUES (v_tmpl, 'בחורות',        '#ef4444', 6) RETURNING id INTO g_bachurot;
  INSERT INTO activity_template_groups (activity_template_id, name, color, sort_order) VALUES (v_tmpl, 'ילדים',         '#8b5cf6', 7) RETURNING id INTO g_yeladim;
  INSERT INTO activity_template_groups (activity_template_id, name, color, sort_order) VALUES (v_tmpl, 'בחורים',        '#14b8a6', 8) RETURNING id INTO g_bachurim;
  INSERT INTO activity_template_groups (activity_template_id, name, color, sort_order) VALUES (v_tmpl, 'ילדות',         '#f97316', 9) RETURNING id INTO g_yeladot;

  -- Tasks (name, points, sort_order)
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('העמדתי את כל המשפחה לתמונה משפחתית',                                               50, 1)  RETURNING id INTO t1;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('שמרתי על הילדים בבריכה',                                                             35, 2)  RETURNING id INTO t2;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('למדתי בבוקר לפחות שעה',                                                              30, 3)  RETURNING id INTO t3;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('התפללתי בזמן תפילת שחרית',                                                            20, 4)  RETURNING id INTO t4;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('סידרתי את חדר האוכל לפני הארוחה',                                                    15, 5)  RETURNING id INTO t5;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('סידרתי את חדר האוכל אחרי הארוחה',                                                    15, 6)  RETURNING id INTO t6;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('התקשרתי לסבא וסבתא לפני חג לאחל חג שמח',                                             30, 7)  RETURNING id INTO t7;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('התחייבתי להזמין אחד הדודים בחודשיים הקרובים לסעודת ליל שבת',                         35, 8)  RETURNING id INTO t8;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('התחייבתי להתקשר לבת דודה ולהתעניין בשלומה',                                          20, 9)  RETURNING id INTO t9;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('התחייבתי להתקשר לבן דוד ולאחל לו בהצלחה',                                            20, 10) RETURNING id INTO t10;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('ארגנתי תחרות שחייה בבריכה',                                                           50, 11) RETURNING id INTO t11;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('מצאתי את המטמון',                                                                     40, 12) RETURNING id INTO t12;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('מסרתי רעיון קצר / סיפור יפה בעזרת גברים באחת הארוחות',                               35, 13) RETURNING id INTO t13;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('ארגנתי מקהלת שירי ילדים לארוחת ערב',                                                  40, 14) RETURNING id INTO t14;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('שרתי במקהלת הילדים',                                                                  15, 15) RETURNING id INTO t15;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('אמרתי לסבא וסבתא תודה רבה על הנופש',                                                 10, 16) RETURNING id INTO t16;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('לקחתי טרמפ לסיבוב ביישוב עם סבא ובני דודים',                                         20, 17) RETURNING id INTO t17;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('שיתפתי פעולה בתוכנית של הדוד',                                                        15, 18) RETURNING id INTO t18;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('ארגנתי את החדר אוכל למקהלת הבנים',                                                    15, 19) RETURNING id INTO t19;
  INSERT INTO template_tasks (name, points, sort_order) VALUES ('קיפלתי מפיות לאחת הארוחות',                                                           15, 20) RETURNING id INTO t20;

  -- Link all tasks to the template
  INSERT INTO activity_template_tasks (activity_template_id, template_task_id, sort_order) VALUES
    (v_tmpl, t1,  1),  (v_tmpl, t2,  2),  (v_tmpl, t3,  3),  (v_tmpl, t4,  4),  (v_tmpl, t5,  5),
    (v_tmpl, t6,  6),  (v_tmpl, t7,  7),  (v_tmpl, t8,  8),  (v_tmpl, t9,  9),  (v_tmpl, t10, 10),
    (v_tmpl, t11, 11), (v_tmpl, t12, 12), (v_tmpl, t13, 13), (v_tmpl, t14, 14), (v_tmpl, t15, 15),
    (v_tmpl, t16, 16), (v_tmpl, t17, 17), (v_tmpl, t18, 18), (v_tmpl, t19, 19), (v_tmpl, t20, 20);

  -- Group eligibility for tasks (no rows = available to all groups)
  -- t1:  all
  -- t2:  דודים, דודות, זו"צים
  INSERT INTO template_task_groups VALUES (t2, 'דודים'), (t2, 'דודות'), (t2, 'זו"צים');
  -- t3:  בחורים, ילדים
  INSERT INTO template_task_groups VALUES (t3, 'בחורים'), (t3, 'ילדים');
  -- t4:  all
  -- t5:  all
  -- t6:  all
  -- t7:  זו"צים
  INSERT INTO template_task_groups VALUES (t7, 'זו"צים');
  -- t8:  דודים, דודות
  INSERT INTO template_task_groups VALUES (t8, 'דודים'), (t8, 'דודות');
  -- t9:  בחורות, ילדות
  INSERT INTO template_task_groups VALUES (t9, 'בחורות'), (t9, 'ילדות');
  -- t10: בחורים, ילדים
  INSERT INTO template_task_groups VALUES (t10, 'בחורים'), (t10, 'ילדים');
  -- t11: all
  -- t12: ילדים, ילדות
  INSERT INTO template_task_groups VALUES (t12, 'ילדים'), (t12, 'ילדות');
  -- t13: בחורים
  INSERT INTO template_task_groups VALUES (t13, 'בחורים');
  -- t14: בחורות, זו"צים
  INSERT INTO template_task_groups VALUES (t14, 'בחורות'), (t14, 'זו"צים');
  -- t15: ילדים, ילדות
  INSERT INTO template_task_groups VALUES (t15, 'ילדים'), (t15, 'ילדות');
  -- t16: all
  -- t17: בחורים, ילדים
  INSERT INTO template_task_groups VALUES (t17, 'בחורים'), (t17, 'ילדים');
  -- t18: all
  -- t19: all
  -- t20: ילדות
  INSERT INTO template_task_groups VALUES (t20, 'ילדות');

  -- Rewards (threshold-based, global — no group restriction)
  INSERT INTO template_rewards (activity_template_id, name, required_points, sort_order) VALUES
    (v_tmpl, 'מקופלת',  300,  1),
    (v_tmpl, 'פחית',    500,  2),
    (v_tmpl, 'צ''יפס',  800,  3),
    (v_tmpl, 'ארטיק',   1000, 4);

END $$;
