-- Migration 073: Bulk roster import from a spreadsheet (wizard groups/participants steps).
-- Run in the Supabase SQL Editor.
--
-- The client uploads one row per participant - their name and, optionally, the
-- group they belong to - so a single file fills both wizard steps. Doing the
-- write here rather than from the browser matters for two reasons:
--
--   * participants_auto_code derives external_id from the rows already
--     committed for the event, so rows must be inserted one statement at a
--     time. A multi-row INSERT would hand every row the same code and trip
--     idx_participants_event_external_id. The loop below gives each INSERT its
--     own command, which is exactly what the trigger expects.
--   * the whole import is one transaction, so a plan-limit rejection rolls back
--     cleanly instead of leaving a half-imported roster behind.
--
-- SECURITY DEFINER to bypass RLS for the junction writes; access is checked
-- explicitly against the same rule the RLS policies use (owner, collaborator,
-- or super admin). check_plan_limit still fires on every participant insert,
-- so activation caps are enforced exactly as they are for manual entry.

CREATE OR REPLACE FUNCTION public.import_event_roster(
  p_event_id UUID,
  p_groups   JSONB DEFAULT '[]'::jsonb,  -- [{"name": "...", "color": "#RRGGBB"}]
  p_rows     JSONB DEFAULT '[]'::jsonb   -- [{"name": "...", "group": "..."}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group      JSONB;
  v_row        JSONB;
  v_name       TEXT;
  v_group_name TEXT;
  v_color      TEXT;
  v_group_id   UUID;
  v_participant_id UUID;
  v_has_groups BOOLEAN;
  v_groups_created       INT := 0;
  v_participants_created INT := 0;
  v_skipped              INT := 0;
BEGIN
  IF NOT (
    public.is_event_owner(p_event_id)
    OR EXISTS (
      SELECT 1 FROM event_collaborators
      WHERE event_id = p_event_id AND user_id = auth.uid()
    )
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: no access to this event';
  END IF;

  IF jsonb_typeof(p_groups) <> 'array' OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'ROSTER_INVALID_PAYLOAD';
  END IF;

  IF jsonb_array_length(p_rows) > 2000 OR jsonb_array_length(p_groups) > 200 THEN
    RAISE EXCEPTION 'ROSTER_TOO_LARGE';
  END IF;

  -- ============================================================
  -- 1. Create the groups named in the file that don't exist yet
  -- ============================================================
  FOR v_group IN SELECT * FROM jsonb_array_elements(p_groups) LOOP
    v_group_name := btrim(COALESCE(v_group->>'name', ''));
    CONTINUE WHEN v_group_name = '';

    v_color := COALESCE(v_group->>'color', '#D83000');
    IF v_color !~* '^#[0-9a-f]{6}$' THEN
      v_color := '#D83000';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM groups
      WHERE event_id = p_event_id AND lower(btrim(name)) = lower(v_group_name)
    ) THEN
      INSERT INTO groups (event_id, name, color)
      VALUES (p_event_id, v_group_name, v_color);
      v_groups_created := v_groups_created + 1;
    END IF;
  END LOOP;

  SELECT EXISTS (SELECT 1 FROM groups WHERE event_id = p_event_id) INTO v_has_groups;

  -- ============================================================
  -- 2. Create the participants and their group memberships
  -- ============================================================
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_name := btrim(COALESCE(v_row->>'name', ''));
    CONTINUE WHEN v_name = '';

    -- Re-running the same file must not duplicate the roster.
    IF EXISTS (
      SELECT 1 FROM participants
      WHERE event_id = p_event_id AND lower(btrim(name)) = lower(v_name)
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO participants (event_id, name)
    VALUES (p_event_id, v_name)
    RETURNING id INTO v_participant_id;

    v_participants_created := v_participants_created + 1;

    v_group_name := btrim(COALESCE(v_row->>'group', ''));

    IF v_group_name <> '' THEN
      SELECT id INTO v_group_id
      FROM groups
      WHERE event_id = p_event_id AND lower(btrim(name)) = lower(v_group_name)
      LIMIT 1;

      IF v_group_id IS NOT NULL THEN
        INSERT INTO participant_groups (participant_id, group_id)
        VALUES (v_participant_id, v_group_id)
        ON CONFLICT DO NOTHING;
      END IF;
    ELSIF v_has_groups THEN
      -- No group stated: join every group, the same default a manually added
      -- participant gets, so nobody is left ungrouped.
      INSERT INTO participant_groups (participant_id, group_id)
      SELECT v_participant_id, id FROM groups WHERE event_id = p_event_id
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'participants_created', v_participants_created,
    'groups_created', v_groups_created,
    'skipped', v_skipped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_event_roster(UUID, JSONB, JSONB) TO authenticated;
