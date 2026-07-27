-- Apply on remote if migrations are not auto-run:
--   Supabase SQL editor - paste this file, run once.
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP/CREATE policy + CREATE OR
-- REPLACE function, safe to re-run.
--
-- Source: migrations/081_scan_lottery_entries.sql
-- Needed by: the scan lottery. Requires 080 (APPLY_SCAN_LOTTERY.sql) first -
-- this adds the ticket table and replaces the pool function 080 created.
-- Until it runs, the pool is still counted from the whole game's scan log
-- (every station, a ticket per scan) instead of from the lottery's own
-- scanner, one ticket each.

-- Migration 081: lottery tickets are earned at the lottery, and one each.
--
-- 080 built the pool by counting every point_transactions row inside the
-- round's window. That was wrong in two ways, and this migration fixes both.
--
-- WRONG #1 - it counted scans that had nothing to do with the lottery.
--
-- A game has scanning stations running all through it. Under 080, every scan
-- on every one of them landed in the lottery just for happening while the
-- round was open: a participant who never went near the lottery was in the
-- hat, and the organizer could not see why. A ticket has to be earned *at the
-- lottery* - by scanning on the lottery screen, in front of the room.
--
-- That is not something a scan row can tell us after the fact. A scan does not
-- record where it was taken, and giving point_transactions a lottery column
-- would put the lottery inside the scoring path that every device shares. So
-- the entry becomes its own row, written by the lottery's own scanner and by
-- nothing else. This is the ticket table 080 argued against - and the argument
-- has flipped, because a ticket is no longer derivable from a scan.
--
-- WRONG #2 - it gave a ticket per scan.
--
-- Fifteen scans meant fifteen tickets. The rule is now one ticket per
-- participant per round, however many times they scan. That is the primary
-- key below: (round_id, participant_id). A second scan by the same person
-- cannot create a second row, so the cap holds no matter which client writes,
-- how many screens are open, or how fast the two arrive.
--
-- What is kept from 080's reasoning: a deleted scan must not leave a ticket
-- behind. transaction_id references the scan with ON DELETE CASCADE, so an
-- operator deleting a scan (074) takes its ticket with it, exactly as when the
-- pool was derived.

CREATE TABLE IF NOT EXISTS lottery_entries (
  round_id       UUID NOT NULL REFERENCES lottery_rounds(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  -- The scan that earned it. Cascades, so deleting the scan revokes the ticket.
  transaction_id UUID NOT NULL REFERENCES point_transactions(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One ticket per participant per round. This is the whole cap.
  PRIMARY KEY (round_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_entries_transaction
  ON lottery_entries(transaction_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- The same people who may run the round may write and read its tickets: the
-- game's owner and its collaborators. Spelled out rather than routed through
-- can_manage_event (017), which is not applied everywhere this schema runs -
-- same reasoning as 080's policies.
--
-- There is no UPDATE policy on purpose. A ticket is a fact about a scan that
-- happened; it is created or it is deleted with its scan, never edited.
ALTER TABLE lottery_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view lottery entries" ON lottery_entries;
CREATE POLICY "Managers can view lottery entries"
  ON lottery_entries FOR SELECT
  USING (
    round_id IN (
      SELECT lr.id FROM lottery_rounds lr
      WHERE public.is_event_owner(lr.event_id)
         OR lr.event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
         OR public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS "Managers can add lottery entries" ON lottery_entries;
CREATE POLICY "Managers can add lottery entries"
  ON lottery_entries FOR INSERT
  WITH CHECK (
    round_id IN (
      SELECT lr.id FROM lottery_rounds lr
      -- Only into a round that is still collecting. Closing the lottery has to
      -- mean closed: past that moment the pool the organizer drew from cannot
      -- gain a name, whatever a late client tries to write.
      WHERE lr.closed_at IS NULL
        AND (
          public.is_event_owner(lr.event_id)
          OR lr.event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Managers can delete lottery entries" ON lottery_entries;
CREATE POLICY "Managers can delete lottery entries"
  ON lottery_entries FOR DELETE
  USING (
    round_id IN (
      SELECT lr.id FROM lottery_rounds lr
      WHERE public.is_event_owner(lr.event_id)
         OR lr.event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
    )
  );

-- ============================================================
-- THE POOL
-- ============================================================
-- Same signature as 080's version, so every caller is unchanged: one row per
-- participant, with a ticket count. What changed is where the rows come from -
-- the round's own tickets, not the game's scan log - and that `entries` is now
-- always 1, guaranteed by the primary key rather than by this query.
--
-- The window no longer filters anything here: a ticket exists because it was
-- written while the round was open, which the INSERT policy above enforces.
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
BEGIN
  RETURN QUERY
  SELECT
    p.id AS participant_id,
    p.name AS participant_name,
    1::BIGINT AS entries
  FROM lottery_entries le
  JOIN participants p ON p.id = le.participant_id
  WHERE le.round_id = p_round_id
  ORDER BY p.name ASC;
END;
$$;
