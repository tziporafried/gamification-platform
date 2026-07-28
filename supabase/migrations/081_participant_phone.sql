-- Migration 081: a phone number per participant, for the games that text them.
--
-- Only games with the `sms_notifications` flag ask for one, so the column is
-- nullable and stays empty everywhere else. A participant is still a name;
-- the phone is what the games that were sold SMS need in order to reach them.
--
-- The flag itself is not created here. Flags are created in the admin panel,
-- by hand, which is the whole point of the catalogue in 076 - this file only
-- makes room for what the flag collects. Until somebody creates the key
-- `sms_notifications` there, no game has it and no phone field appears.
--
-- Stored in E.164 (`+972501234567`) and in nothing else. What a person types is
-- never that shape - `050-1234567`, `+972 (0)50 123 4567`, or a bare
-- `501234567` from a spreadsheet that stored the phone as a number and ate the
-- leading zero - so the client normalises before writing (src/lib/phone.ts).
-- The CHECK below is what makes that a rule rather than a habit: one shape to
-- hand a gateway, and the same line written twice is one number, not two.
--
-- No unique index. Two participants sharing a phone is ordinary - a parent
-- signing up two children, one work phone for a team - and a rejected insert
-- deep inside a roster import is a worse answer than two people who get the
-- same message.

ALTER TABLE participants ADD COLUMN IF NOT EXISTS phone TEXT;

-- E.164: a leading +, a country code that never starts with 0, and 8-15 digits
-- in total. Written as a named constraint so re-running this file is safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participants_phone_e164'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_phone_e164
      CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$');
  END IF;
END $$;

COMMENT ON COLUMN participants.phone IS
  'E.164 phone (+972501234567), for games with the sms_notifications feature flag. NULL when unknown.';

-- ============================================================
-- ROSTER IMPORT: carry the phone in from the file
-- ============================================================
-- Same signature as 073, so this replaces it in place - the client sends a
-- `phone` on each row only when the game has the flag, and an older client
-- that sends none leaves the column NULL exactly as before.
--
-- The value is taken only when it already matches the CHECK. The client
-- normalises and counts the rows it could not read, so a value arriving here
-- in another shape is a bug rather than a user's typo - and dropping the phone
-- keeps the participant, where raising would abandon the whole import.

CREATE OR REPLACE FUNCTION public.import_event_roster(
  p_event_id UUID,
  p_groups   JSONB DEFAULT '[]'::jsonb,  -- [{"name": "...", "color": "#RRGGBB"}]
  p_rows     JSONB DEFAULT '[]'::jsonb   -- [{"name": "...", "group": "...", "phone": "+972..."}]
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
  v_phone      TEXT;
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

    v_phone := btrim(COALESCE(v_row->>'phone', ''));
    IF v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
      v_phone := NULL;
    END IF;

    INSERT INTO participants (event_id, name, phone)
    VALUES (p_event_id, v_name, v_phone)
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
