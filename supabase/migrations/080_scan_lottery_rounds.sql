-- Migration 080: the scan lottery's collection window.
--
-- The lottery has always drawn from the leaderboard: every eligible player is
-- one name in the hat, and points decide who is eligible. The scan lottery
-- (feature flag `scan_based_lottery`, catalogue row in 076) asks a different
-- question - not "who has enough points" but "who kept scanning while the
-- lottery was open". Fifteen scans is fifteen tickets; points are ignored.
--
-- The flag *adds* that second lottery; it does not replace the first. A game
-- that has it keeps the points lottery in full, and the organizer picks which
-- one to run each time they set a lottery up - a points draw for one prize, a
-- scan draw for the next. So this table describes rounds of the scan lottery
-- only, and a game with the flag will happily have none of them.
--
-- That needs one thing the points lottery does not: a window. The organizer
-- opens the lottery, the floor keeps scanning, the organizer closes it, and
-- only what landed in between counts. This table is that window - one row per
-- round, opened_at..closed_at.
--
-- What it deliberately does NOT hold is the entries themselves.
--
-- A successful scan is already a point_transactions row, so a ticket table
-- would be a second copy of something we can count: it could drift, it would
-- need its own insert on the scan path (which every scanner device, kiosk and
-- offline export shares), and deleting a scan (074) would leave its ticket
-- behind. Entries are therefore derived - get_scan_lottery_entries below
-- counts the scans inside the window. Nothing on the scanning side changes at
-- all: a scan lands in the pool because it happened, not because someone
-- remembered to write a ticket for it.

-- Prerequisites, named up front. Without this the first thing that fails is a
-- policy, and postgres reports it as "function ... does not exist" with no
-- clue which migration is missing.
DO $$
BEGIN
  IF to_regprocedure('public.is_event_owner(uuid)') IS NULL
     OR to_regclass('public.event_collaborators') IS NULL THEN
    RAISE EXCEPTION
      'Migration 080 needs 012 (is_event_owner + event_collaborators) applied first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS lottery_rounds (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Scans from opened_at (inclusive) until closed_at (exclusive) are entries.
  opened_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL = still collecting. Set once, when the organizer closes the lottery.
  closed_at  TIMESTAMPTZ,
  opened_by  UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lottery_rounds_window CHECK (closed_at IS NULL OR closed_at >= opened_at)
);

-- One open round per game, enforced here rather than in the client: two
-- organizer screens on the same game would otherwise each open their own and
-- split the floor's scans between two pools.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lottery_rounds_one_open
  ON lottery_rounds(event_id)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lottery_rounds_event
  ON lottery_rounds(event_id, opened_at DESC);

DROP TRIGGER IF EXISTS lottery_rounds_updated_at ON lottery_rounds;
CREATE TRIGGER lottery_rounds_updated_at
  BEFORE UPDATE ON lottery_rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Exactly who could already run a lottery: the game's owner and its
-- collaborators. Opening or closing a round is the same act of running the
-- game's live event, so it carries the same permission - no wider, no
-- narrower. Super admins keep the read they have elsewhere.
--
-- The owner half goes through is_event_owner (012), which is SECURITY DEFINER
-- and so does not recurse into events' own policies. The collaborator half is
-- spelled out against event_collaborators rather than called through
-- can_manage_event (017), because 017 is not applied everywhere this schema
-- runs and a policy that references a missing function fails the whole
-- migration. 075 resolved the same question the same way; this matches it, so
-- there is one pattern in recent migrations rather than two.
--
-- Scanner devices need nothing here. They never read or write this table; a
-- scan enters the pool because the round's window contains it.
ALTER TABLE lottery_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view lottery rounds" ON lottery_rounds;
CREATE POLICY "Managers can view lottery rounds"
  ON lottery_rounds FOR SELECT
  USING (
    public.is_event_owner(event_id)
    OR event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Managers can open lottery rounds" ON lottery_rounds;
CREATE POLICY "Managers can open lottery rounds"
  ON lottery_rounds FOR INSERT
  WITH CHECK (
    public.is_event_owner(event_id)
    OR event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Managers can close lottery rounds" ON lottery_rounds;
CREATE POLICY "Managers can close lottery rounds"
  ON lottery_rounds FOR UPDATE
  USING (
    public.is_event_owner(event_id)
    OR event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.is_event_owner(event_id)
    OR event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Managers can delete lottery rounds" ON lottery_rounds;
CREATE POLICY "Managers can delete lottery rounds"
  ON lottery_rounds FOR DELETE
  USING (
    public.is_event_owner(event_id)
    OR event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
  );

-- ============================================================
-- THE POOL
-- ============================================================
-- One row per participant who scanned inside the window, with how many tickets
-- that earned them. The shape mirrors get_participant_leaderboard (020) - id,
-- name, one number - so the client can feed either into the same draw.
--
-- SECURITY INVOKER, like the leaderboard functions: the caller's own RLS
-- decides which round they can resolve and which scans they can count. An
-- unreadable or unknown round returns no rows rather than an error, which the
-- client shows as an empty pool.
CREATE OR REPLACE FUNCTION get_scan_lottery_entries(p_round_id UUID)
RETURNS TABLE (
  participant_id UUID,
  participant_name TEXT,
  entries BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_event_id  UUID;
  v_opened_at TIMESTAMPTZ;
  v_closed_at TIMESTAMPTZ;
BEGIN
  SELECT lr.event_id, lr.opened_at, lr.closed_at
    INTO v_event_id, v_opened_at, v_closed_at
  FROM lottery_rounds lr
  WHERE lr.id = p_round_id;

  IF v_event_id IS NULL THEN
    RETURN;
  END IF;

  -- An open round counts everything up to now, so the organizer's dock shows
  -- the pool growing live. A closed one is frozen at closed_at: reopening the
  -- same round is impossible, so this answer never changes again.
  RETURN QUERY
  SELECT
    p.id AS participant_id,
    p.name AS participant_name,
    COUNT(pt.id) AS entries
  FROM point_transactions pt
  JOIN participants p ON p.id = pt.participant_id
  WHERE pt.event_id = v_event_id
    AND pt.created_at >= v_opened_at
    AND (v_closed_at IS NULL OR pt.created_at < v_closed_at)
  GROUP BY p.id, p.name
  ORDER BY COUNT(pt.id) DESC, p.name ASC;
END;
$$;

-- The window scan is served by idx_point_transactions_event_created (003) -
-- (event_id, created_at DESC) - so no new index is needed here.
