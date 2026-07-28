-- Apply on remote if migrations are not auto-run:
--   Supabase SQL editor - paste this file, run once.
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE, safe to re-run.
--
-- Source: migrations/083_participant_name_parts.sql
-- Needed by: the two name columns in the roster import, for games with the
-- `import_csv` flag. Until this runs, an import from an updated client still
-- works - it sends the joined name as well, and the older function reads that -
-- but the division is dropped and every imported participant keeps their whole
-- name as a first name. Nothing else in the app changes either way: `name` is
-- the display column before this file and after it.
--
-- Safe on a live event. Existing participants are backfilled first_name = name,
-- last_name = '' - no stored name is altered, split or reordered.

-- Migration 083: a participant's name in two parts, for the games that import one.
--
-- A roster typed by hand is one field and always was: whatever the organiser
-- types is the person's name, and asking them to guess where a name divides
-- would be a worse form than the one they have. A roster imported from a file
-- is different - the file already holds two columns, because whoever exported
-- it from their own system had them - and throwing the division away on the way
-- in is losing something the customer already owns.
--
-- So: two nullable columns beside the name, and `name` stays exactly what it
-- has always been. Every leaderboard function, every lottery screen, the QR
-- cards, the SMS and the offline pack read `name` and keep reading `name` -
-- none of them are touched by this file. The trigger below is what makes that
-- true: `name` is derived from the parts and can no longer drift from them.
--
-- Which way the derivation runs depends on who wrote:
--
--   * parts written  -> `name` is rebuilt from them. The import, and the row
--                       edit in a game that has the import.
--   * only `name`    -> the whole of it becomes the first name and the last is
--                       empty. The typed field, an older client that has never
--                       heard of the parts, and the offline sync.
--
-- The second rule is also the backfill, applied to every participant already in
-- the database. Nobody's name is split retroactively: splitting on a space
-- guesses, and it guesses wrong on exactly the names it would be most insulting
-- to get wrong - בן אבו, דה לה טורה, אבו חצירא, a two-word given name. The
-- names already stored come through this migration byte for byte, which is what
-- makes it safe to run on a live event.

ALTER TABLE participants ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- The whole existing name is the first name. See above for why it is not split.
--
-- `name` is deliberately absent from the SET: what the organiser typed stays
-- exactly as they typed it, and this runs before the trigger below exists, so
-- there is nothing that could rewrite it either. Only the new columns are
-- filled, and btrim gives them the shape every later write produces.
UPDATE participants
SET first_name = btrim(name),
    last_name  = ''
WHERE first_name IS NULL;

COMMENT ON COLUMN participants.first_name IS
  'Given name. The whole typed name when the game has no import; column 1 of the file when it does.';
COMMENT ON COLUMN participants.last_name IS
  'Family name, or '''' when there is none. Only an imported roster fills this in.';

-- ============================================================
-- KEEPING name AND ITS PARTS THE SAME FACT
-- ============================================================
-- BEFORE, so `name` is already correct by the time NOT NULL, the plan-limit
-- trigger and the auto-code trigger look at the row.

CREATE OR REPLACE FUNCTION public.participants_sync_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.first_name IS NULL AND NEW.last_name IS NULL THEN
      -- Typed into the single field, or written by a client from before this
      -- migration. Either way the whole of it is the first name.
      NEW.first_name := btrim(COALESCE(NEW.name, ''));
      NEW.last_name  := '';
    ELSE
      NEW.first_name := btrim(COALESCE(NEW.first_name, ''));
      NEW.last_name  := btrim(COALESCE(NEW.last_name, ''));
      NEW.name       := btrim(NEW.first_name || ' ' || NEW.last_name);
    END IF;

  ELSE
    IF NEW.first_name IS DISTINCT FROM OLD.first_name
       OR NEW.last_name IS DISTINCT FROM OLD.last_name THEN
      NEW.first_name := btrim(COALESCE(NEW.first_name, ''));
      NEW.last_name  := btrim(COALESCE(NEW.last_name, ''));
      NEW.name       := btrim(NEW.first_name || ' ' || NEW.last_name);

    ELSIF NEW.name IS DISTINCT FROM OLD.name THEN
      -- Somebody rewrote the whole name without saying how it divides. Taking
      -- all of it as the first name is the same rule the typed field follows,
      -- and it is the only answer that cannot invent a family name.
      NEW.first_name := btrim(COALESCE(NEW.name, ''));
      NEW.last_name  := '';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS participants_sync_name ON participants;
CREATE TRIGGER participants_sync_name
  BEFORE INSERT OR UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION public.participants_sync_name();

-- ============================================================
-- ROSTER IMPORT: carry both parts in from the file
-- ============================================================
-- Same signature as 073 and 081, so this replaces them in place.
--
-- Each row may now carry `first_name` and `last_name`. It still carries `name`
-- as well, joined by the client - which is what lets a client that has been
-- updated talk to a database that has not: the older function reads the `name`
-- it understands and ignores the rest, and this one prefers the parts and falls
-- back to `name` when a row has none. Neither direction has a broken state.
--
-- The duplicate check stays on the full name, which is where it always was: a
-- second דנה כהן is the same person as the first however the file spells the
-- columns, and re-running a file must still import nobody twice.

CREATE OR REPLACE FUNCTION public.import_event_roster(
  p_event_id UUID,
  p_groups   JSONB DEFAULT '[]'::jsonb,  -- [{"name": "...", "color": "#RRGGBB"}]
  p_rows     JSONB DEFAULT '[]'::jsonb   -- [{"first_name": "...", "last_name": "...", "name": "...", "group": "...", "phone": "+972..."}]
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
    'groups_created', v_groups_created,
    'skipped', v_skipped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_event_roster(UUID, JSONB, JSONB) TO authenticated;
