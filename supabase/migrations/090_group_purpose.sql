-- Migration 090: a group says what it was made for.
--
-- A group has meant two different things all along, and the app could not tell
-- them apart:
--
--   * a side in the competition - it has a score, it is ranked against the
--     other groups, it can win.
--   * a way of addressing part of the roster - this task is for the juniors,
--     this prize is for staff, draw the raffle from the guests only.
--
-- The second kind was built out of the first, because the first was all there
-- was. The cost lands on the leaderboard: "צוות היגוי", a group that exists so
-- three tasks can be aimed at it, appears on the podium at the end of the game
-- next to the teams that actually competed, usually near the bottom because it
-- has four members. The organiser's answer today is to not create the group and
-- hand the tasks out by hand.
--
--   purpose = 'competition'   the default, and what every existing group is.
--                             Scored and ranked, exactly as before.
--   purpose = 'distribution'  a group for aiming tasks, prizes and draws at.
--                             Never appears on a leaderboard.
--
-- Distribution is the only thing that changes, and only where ranking happens.
-- Everywhere a group is *chosen* - a task's eligible groups, a prize's groups,
-- the lottery filter, a participant's membership - both kinds are offered and
-- behave identically. That is the whole point: the group keeps working as a
-- way to address people, and stops pretending to be a contestant.
--
-- ── Scored, but not ranked ───────────────────────────────────────────────────
-- Points are not touched. A participant in a distribution group still scores
-- for themselves, and still scores for whichever competing groups they are in;
-- point_transactions has no idea groups exist. This migration only decides
-- which rows get_group_leaderboard returns.
--
-- ── What this file does NOT do ───────────────────────────────────────────────
-- It does not create the `group_purpose` feature flag - flags are made by hand
-- in the admin panel. Without the flag no client offers the choice, so every
-- group is created 'competition' and the game behaves exactly as it does today.
-- Applying this file alone changes nothing anyone can see.

-- ============================================================
-- 1. WHAT THE GROUP IS FOR
-- ============================================================
-- NOT NULL DEFAULT 'competition': every row that already exists is a
-- contestant, which is what it has been since groups shipped. No backfill, no
-- row rewritten to mean something new.
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'competition';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_purpose_check') THEN
    ALTER TABLE groups
      ADD CONSTRAINT groups_purpose_check CHECK (purpose IN ('competition', 'distribution'));
  END IF;
END $$;

COMMENT ON COLUMN groups.purpose IS
  'competition = a side in the game, ranked on the group leaderboard. '
  'distribution = a group used only to aim tasks, prizes and draws at; never ranked.';

-- ============================================================
-- 2. THE GROUP LEADERBOARD LEAVES THE DISTRIBUTION GROUPS OUT
-- ============================================================
-- Replaces the function from 020, unchanged apart from the one WHERE clause.
--
-- Written as `<> 'distribution'` rather than `= 'competition'` so a purpose
-- added later is ranked unless it says otherwise - a group whose meaning this
-- function does not recognise is safer on the board than silently missing from
-- it, which would read as lost points.
--
-- Not gated on the feature flag, deliberately, and it cannot be: SQL cannot see
-- the catalogue. It does not need to be either - without the flag no client can
-- write 'distribution', so there is nothing for the filter to remove.
CREATE OR REPLACE FUNCTION get_group_leaderboard(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  group_id UUID,
  group_name TEXT,
  group_color TEXT,
  total_points BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  IF p_event_id IS NOT NULL THEN
    v_event_id := p_event_id;
  ELSE
    SELECT id INTO v_event_id
    FROM events
    WHERE owner_admin_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_event_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    g.id AS group_id,
    g.name AS group_name,
    g.color AS group_color,
    COALESCE(SUM(pt.points), 0) AS total_points
  FROM groups g
  LEFT JOIN participant_groups pg
    ON pg.group_id = g.id
  LEFT JOIN point_transactions pt
    ON pt.participant_id = pg.participant_id
    AND pt.event_id = v_event_id
  WHERE g.event_id = v_event_id
    AND g.purpose <> 'distribution'
  GROUP BY g.id, g.name, g.color
  ORDER BY total_points DESC, g.name ASC;
END;
$$;
