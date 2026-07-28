-- Apply on remote if migrations are not auto-run:
--   Supabase SQL editor - paste this file, run once.
-- Idempotent: DROP ... IF EXISTS + CREATE OR REPLACE, safe to re-run.
--
-- Source: migrations/085_import_roster_replace.sql
-- Needed by: the "החלפת הרשימה" option in the roster import dialog. Until this
-- runs the option is still shown and still works, because the client falls back
-- to deleting the roster itself before importing - but it does so outside the
-- import's transaction, so a file that trips the plan limit half way leaves the
-- event emptied. Running this is what makes the replace all-or-nothing.
--
-- Run after 083. Replacing a roster deletes participants, and their scans and
-- rewards with them - see the note in the migration.

-- Migration 085: an uploaded file can be the roster, not only an addition to it.
--
-- Until now every import merged: a name already in the event was skipped, and
-- nothing about that participant changed. That is the right default - it is what
-- makes re-uploading the same file harmless - but it is not the only thing
-- customers do with a spreadsheet. A list that was corrected outside the app,
-- a class that changed between terms, a file uploaded before the event started
-- and fixed afterwards: in all of those the file IS the list, and merging just
-- leaves the mistakes behind alongside the corrections.
--
-- So the caller chooses, and the choice is the new `p_replace`:
--
--   FALSE (default)  merge - add the names that are new, skip the ones that are
--                    already there. Exactly what every import did before this.
--   TRUE             replace - the event's participants are deleted first, and
--                    the file becomes the whole roster.
--
-- Replacing destroys scores. point_transactions and participant_rewards both
-- CASCADE off participants, so removing somebody removes every point they ever
-- scored. There is no version of "replace the list" that does not: a participant
-- who is not on the new list has no row to hang their history from. What the
-- app owes the operator is to say so before they choose, with the real numbers -
-- which is the warning in RosterImportModal, not a line in this file.
--
-- Groups are left alone either way. The file names groups and creates the ones
-- that are missing; it never said anything about deleting them, and a replace
-- that silently dropped the event's group structure would surprise everybody.
--
-- The old three-argument signature is dropped rather than left beside this one.
-- Two overloads of the same name is how PostgREST starts guessing, and a client
-- that sends no p_replace still resolves here through the DEFAULT.

DROP FUNCTION IF EXISTS public.import_event_roster(UUID, JSONB, JSONB);

CREATE OR REPLACE FUNCTION public.import_event_roster(
  p_event_id UUID,
  p_groups   JSONB DEFAULT '[]'::jsonb,  -- [{"name": "...", "color": "#RRGGBB"}]
  p_rows     JSONB DEFAULT '[]'::jsonb,  -- [{"first_name": "...", "last_name": "...", "name": "...", "group": "...", "phone": "+972..."}]
  p_replace  BOOLEAN DEFAULT FALSE       -- TRUE: this file IS the roster, see the header
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group      JSONB;
  v_row        JSONB;
  v_first      TEXT;
  v_last       TEXT;
  v_name       TEXT;
  v_group_name TEXT;
  v_phone      TEXT;
  v_color      TEXT;
  v_group_id   UUID;
  v_participant_id UUID;
  v_has_groups BOOLEAN;
  v_groups_created       INT := 0;
  v_participants_created INT := 0;
  v_participants_deleted INT := 0;
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
  -- 0. Replacing: the roster this file describes is the whole roster
  -- ============================================================
  -- Everyone currently in the event goes, and with them - by the CASCADE on
  -- point_transactions and participant_rewards - every scan they were credited
  -- with and every reward they were given. That is the operation, not a side
  -- effect of it: a list that replaces another list cannot keep the scores of
  -- people it removed. The caller is what has to say so plainly before asking
  -- for this, and RosterImportModal does.
  --
  -- The lottery history survives: lottery_draw_entrants and lottery_draws hold
  -- ON DELETE SET NULL over a stored participant_name, so a draw that already
  -- happened still reads back with the names it drew.
  --
  -- Inside the same transaction as the inserts below, so a file that trips the
  -- plan limit half way leaves the old roster exactly where it was.
  IF p_replace THEN
    DELETE FROM participants WHERE event_id = p_event_id;
    GET DIAGNOSTICS v_participants_deleted = ROW_COUNT;
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
    v_first := btrim(COALESCE(v_row->>'first_name', ''));
    v_last  := btrim(COALESCE(v_row->>'last_name', ''));

    -- A row with neither part is a row from an older client: its whole `name`
    -- is the first name, the same rule the typed field follows.
    IF v_first = '' AND v_last = '' THEN
      v_first := btrim(COALESCE(v_row->>'name', ''));
    END IF;

    v_name := btrim(v_first || ' ' || v_last);
    CONTINUE WHEN v_name = '';

    -- Re-running the same file must not duplicate the roster.
    IF EXISTS (
      SELECT 1 FROM participants
      WHERE event_id = p_event_id AND lower(btrim(name)) = lower(v_name)
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_phone := btrim(COALESCE(v_row->>'phone', ''));
    IF v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
      v_phone := NULL;
    END IF;

    -- `name` is passed too rather than left to the trigger, so this function
    -- still does the right thing if the trigger is ever dropped.
    INSERT INTO participants (event_id, name, first_name, last_name, phone)
    VALUES (p_event_id, v_name, v_first, v_last, v_phone)
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
    'participants_deleted', v_participants_deleted,
    'groups_created', v_groups_created,
    'skipped', v_skipped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_event_roster(UUID, JSONB, JSONB, BOOLEAN) TO authenticated;
