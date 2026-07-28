-- Migration 080: what each lottery actually did, kept for the record.
--
-- Until now a finished lottery left almost nothing behind: the winner went
-- into localStorage (lotteryWinners) so the next draw could exclude them, and
-- that was it. Good enough for the draw itself, useless to whoever runs the
-- programme - they cannot say what was given away last month, who was in the
-- running for it, or how the pool was chosen.
--
-- This is deliberately the opposite call from the scan lottery's *collection*,
-- which lives in localStorage. That one is one operator, one screen, a few
-- minutes, and thrown away when it is done. A record for tracking is read
-- later, often by somebody else, possibly from another machine - which is
-- exactly what a browser profile cannot promise.
--
-- One row per draw, not per lottery: "הגרל שוב" is a fresh draw for the same
-- prize (the first name was not in the room), and the manager wants both the
-- fact that it happened and who each one landed on.
--
-- Names are copied in beside the ids on purpose. A participant deleted from
-- the game must not blank out the history of a prize they won, so the id
-- carries ON DELETE SET NULL while the name stays as written on the night.

CREATE TABLE IF NOT EXISTS lottery_draws (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- What was given away.
  prize_name       TEXT NOT NULL,
  prize_icon       TEXT,

  -- How the pool was chosen - the LotteryEligibilityMode key, plus whatever
  -- that choice needed. 'scans' is the one the organizer sees as
  -- "לפי משתתפים": people scanned in at the lottery itself.
  eligibility_mode TEXT NOT NULL
                   CHECK (eligibility_mode IN ('all', 'min_points', 'scans', 'groups')),
  -- Only meaningful for 'min_points'.
  min_points       INTEGER,
  -- Only meaningful for 'groups'. Not a foreign key: a group renamed or
  -- deleted later must not rewrite or erase what this draw was run on.
  group_ids        UUID[],
  -- The line the audience was shown, e.g. "בוגרים · מתחילים".
  pool_label       TEXT,

  -- The pool. The count is kept beside the list so a draw can be read at a
  -- glance without joining, and still adds up if entrants are ever pruned.
  entrant_count    INTEGER NOT NULL DEFAULT 0,

  -- Who won. NULL only if the participant is deleted from the game later.
  winner_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  winner_name      TEXT NOT NULL,

  -- Which draw of the evening this was, counting redraws for the same prize.
  draw_index       INTEGER NOT NULL DEFAULT 0,

  drawn_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  drawn_by         UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_lottery_draws_event
  ON lottery_draws(event_id, drawn_at DESC);

-- Who was in the running. One row per name in the hat at the moment of the
-- draw - which is the question "מי השתתף" actually asks, and the only way to
-- answer it later once the pool itself is gone.
CREATE TABLE IF NOT EXISTS lottery_draw_entrants (
  draw_id        UUID NOT NULL REFERENCES lottery_draws(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  PRIMARY KEY (draw_id, participant_name)
);

CREATE INDEX IF NOT EXISTS idx_lottery_draw_entrants_participant
  ON lottery_draw_entrants(participant_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Exactly who could run the lottery may read and write its record: the game's
-- owner and its collaborators, plus super admins on read. Spelled out against
-- event_collaborators rather than routed through can_manage_event (017), which
-- is not applied everywhere this schema runs - same reasoning as 075.
--
-- There is no UPDATE and no DELETE policy. A draw is a thing that happened;
-- it is not editable after the fact, which is most of what makes it a record
-- worth keeping. Deleting the game still takes its history with it.
ALTER TABLE lottery_draws ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view lottery draws" ON lottery_draws;
CREATE POLICY "Managers can view lottery draws"
  ON lottery_draws FOR SELECT
  USING (
    public.is_event_owner(event_id)
    OR event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Managers can record lottery draws" ON lottery_draws;
CREATE POLICY "Managers can record lottery draws"
  ON lottery_draws FOR INSERT
  WITH CHECK (
    public.is_event_owner(event_id)
    OR event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
  );

ALTER TABLE lottery_draw_entrants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view lottery entrants" ON lottery_draw_entrants;
CREATE POLICY "Managers can view lottery entrants"
  ON lottery_draw_entrants FOR SELECT
  USING (
    draw_id IN (
      SELECT d.id FROM lottery_draws d
      WHERE public.is_event_owner(d.event_id)
         OR d.event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
         OR public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS "Managers can record lottery entrants" ON lottery_draw_entrants;
CREATE POLICY "Managers can record lottery entrants"
  ON lottery_draw_entrants FOR INSERT
  WITH CHECK (
    draw_id IN (
      SELECT d.id FROM lottery_draws d
      WHERE public.is_event_owner(d.event_id)
         OR d.event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
    )
  );
