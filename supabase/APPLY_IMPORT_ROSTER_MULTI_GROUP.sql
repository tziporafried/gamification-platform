-- Apply on remote if migrations are not auto-run:
--   Supabase SQL editor - paste this file, run once.
-- Idempotent: DROP ... IF EXISTS + CREATE OR REPLACE, safe to re-run.
--
-- Source: migrations/087_import_roster_multi_group.sql
-- Needed by: a roster file whose קבוצה cell names several groups, separated by
-- a comma - "קבוצה א, קבוצה ב". Until this runs the import still accepts such a
-- file and never breaks on it, but the database can only put each participant
-- in the first group named; the rest are created as groups and left empty.
--
-- Supersedes APPLY_IMPORT_ROSTER_REPLACE.sql - this is the whole function, so
-- running only this one is enough even if 085 was never applied.

-- Migration 087: a row in an imported roster can name more than one group.
--
-- participant_groups has been many-to-many since the beginning - a participant
-- added by hand can be ticked into any number of groups - but the import read
-- the group cell as a single name. A file that said "קבוצה א, קבוצה ב" created
-- one group with a comma in its name and put the participant in that.
--
-- So the row now carries `groups`, an array, beside the `group` it always sent:
--
--   {"name": "...", "group": "קבוצה א", "groups": ["קבוצה א", "קבוצה ב"]}
--
-- `groups` wins when it is a non-empty array; `group` is the fallback, which is
-- what a client older than this migration sends and nothing else. Sending both
-- is what lets either side be upgraded first: an old client here still imports
-- one group per row, and a new client against a database still on 085 has its
-- `groups` key ignored and lands each participant in the first group named.
--
-- An empty list still means "no group stated" - join every group in the event,
-- the default a manually added participant gets. Unchanged from 085.
--
-- The signature is untouched, so this is a CREATE OR REPLACE of the body only.
-- Everything else below - the authorisation check, the replace, the plan limit
-- reached through the participants insert - is 085 verbatim.
--
-- Which also makes this file the whole function: a database that never had 085
-- applied gets `p_replace` from here. The three-argument version 085 dropped is
-- dropped here too, for exactly that case - left in place beside this one it
-- would be a second overload of the same name, which is where PostgREST starts
-- guessing which of them the client meant.

DROP FUNCTION IF EXISTS public.import_event_roster(UUID, JSONB, JSONB);

CREATE OR REPLACE FUNCTION public.import_event_roster(
  p_event_id UUID,
  p_groups   JSONB DEFAULT '[]'::jsonb,  -- [{"name": "...", "color": "#RRGGBB"}]
  p_rows     JSONB DEFAULT '[]'::jsonb,  -- [{"first_name": "...", "last_name": "...", "name": "...", "group": "...", "groups": ["..."], "phone": "+972..."}]
  p_replace  BOOLEAN DEFAULT FALSE       -- TRUE: this file IS the roster, see 085
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
  v_row_groups JSONB;
  v_phone      TEXT;
  v_color      TEXT;
  v_group_id   UUID;
  v_participant_id UUID;
  v_has_groups BOOLEAN;
  v_linked     INT;
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

    -- The list, or the single name from a client that only sends one. A `group`
    -- of '' produces an empty array here, which reads as "no group stated".
    v_row_groups := v_row->'groups';
    IF jsonb_typeof(v_row_groups) <> 'array' THEN
      v_row_groups := to_jsonb(
        ARRAY(SELECT btrim(COALESCE(v_row->>'group', '')) WHERE btrim(COALESCE(v_row->>'group', '')) <> '')
      );
    END IF;

    v_linked := 0;
    FOR v_group_name IN SELECT btrim(value) FROM jsonb_array_elements_text(v_row_groups) LOOP
      CONTINUE WHEN v_group_name = '';

      SELECT id INTO v_group_id
      FROM groups
      WHERE event_id = p_event_id AND lower(btrim(name)) = lower(v_group_name)
      LIMIT 1;

      IF v_group_id IS NOT NULL THEN
        INSERT INTO participant_groups (participant_id, group_id)
        VALUES (v_participant_id, v_group_id)
        ON CONFLICT DO NOTHING;
        v_linked := v_linked + 1;
      END IF;
    END LOOP;

    -- No group stated: join every group, the same default a manually added
    -- participant gets, so nobody is left ungrouped. A row that named groups
    -- and matched none of them is left alone rather than swept into all of
    -- them - the file did say where that participant belongs.
    IF v_linked = 0 AND jsonb_array_length(v_row_groups) = 0 AND v_has_groups THEN
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
