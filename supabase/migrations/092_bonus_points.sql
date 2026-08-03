-- Migration 092: an operator can hand a player points for something the game
-- has no card for.
--
-- A bonus is scored on the spot, from the scan screen: pick the player, say
-- what it is for, say how much. It lands in point_transactions like every other
-- score, so the leaderboards, the prize thresholds, the activity feed and the
-- scan log all pick it up with no further work - that is the whole reason it
-- goes in this table rather than one of its own.
--
-- ── Why action_id becomes nullable ──────────────────────────────────────────
-- A bonus is not a task. The two alternatives are both worse:
--
--   * A hidden `actions` row per game. Its `points` are fixed and a bonus's are
--     not, so the row would misstate every award made through it; it would also
--     show up in the task list, the card printing, the readiness checks and the
--     plan's task count - a decoy in every screen that names the game's tasks,
--     for exactly the reason 088 refused to make trivia answers into tasks.
--     And the reason the operator types would still have nowhere to live.
--   * A bonus table of its own. Every leaderboard, every threshold check and
--     every export would then have to read two tables and add them up, and each
--     one that forgot would be quietly wrong.
--
-- So the row keeps its participant, its points and its timestamp, and swaps the
-- task it does not have for the reason it does.
--
-- Existing rows are untouched: every one of them has an action, and the new
-- column is NULL on all of them.

-- ============================================================
-- 1. THE ROW WITHOUT A TASK
-- ============================================================
ALTER TABLE point_transactions
  ALTER COLUMN action_id DROP NOT NULL;

ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS bonus_reason TEXT;

COMMENT ON COLUMN point_transactions.bonus_reason IS
  'What the bonus was for, in the operator''s words. NULL on every scan of a task.';

-- Exactly one of the two: a scan names a task, a bonus names a reason. Neither
-- is a row nothing can explain; both is a bonus pretending to be a scan.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_transactions_task_or_bonus') THEN
    ALTER TABLE point_transactions
      ADD CONSTRAINT point_transactions_task_or_bonus
      CHECK (num_nonnulls(action_id, bonus_reason) = 1);
  END IF;
END $$;

-- A blank reason satisfies the constraint above and explains nothing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_transactions_bonus_reason_not_blank') THEN
    ALTER TABLE point_transactions
      ADD CONSTRAINT point_transactions_bonus_reason_not_blank
      CHECK (bonus_reason IS NULL OR length(btrim(bonus_reason)) > 0);
  END IF;
END $$;

-- ============================================================
-- 2. THE SAME-EVENT GUARD
-- ============================================================
-- 003 installed it, 088 extended it for trivia answers. The action half now
-- runs only when there is an action to check: a bonus has none, so the lookup
-- would return NULL and the IS DISTINCT FROM would raise on every one of them.
-- Everything else is 088 verbatim.
CREATE OR REPLACE FUNCTION check_transaction_same_event()
RETURNS TRIGGER AS $$
DECLARE
  p_event_id UUID;
  a_event_id UUID;
  o_action_id UUID;
BEGIN
  SELECT event_id INTO p_event_id FROM participants WHERE id = NEW.participant_id;

  IF p_event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'Participant does not belong to this event';
  END IF;

  IF NEW.action_id IS NOT NULL THEN
    SELECT event_id INTO a_event_id FROM actions WHERE id = NEW.action_id;

    IF a_event_id IS DISTINCT FROM NEW.event_id THEN
      RAISE EXCEPTION 'Action does not belong to this event';
    END IF;
  END IF;

  IF NEW.action_option_id IS NOT NULL THEN
    SELECT action_id INTO o_action_id FROM action_options WHERE id = NEW.action_option_id;
    IF o_action_id IS DISTINCT FROM NEW.action_id THEN
      RAISE EXCEPTION 'Answer does not belong to this task';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. DELETING ONE
-- ============================================================
-- 074's preview already LEFT JOINs actions, so a bonus deletes correctly as it
-- stands - it just comes back with a NULL name, which the management screen
-- renders as "משימה שנמחקה". Nothing was deleted and the reason is right there
-- on the row, so it says so instead.
--
-- Only the first SELECT changes. The rest is 074 verbatim.
CREATE OR REPLACE FUNCTION public.preview_delete_event_scan(p_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id         UUID;
  v_participant_id   UUID;
  v_points           INTEGER;
  v_participant_name TEXT;
  v_action_name      TEXT;
  v_current          BIGINT;
  v_new              BIGINT;
  v_rewards          JSONB;
BEGIN
  SELECT pt.event_id, pt.participant_id, pt.points, p.name, COALESCE(a.name, pt.bonus_reason)
  INTO v_event_id, v_participant_id, v_points, v_participant_name, v_action_name
  FROM point_transactions pt
  LEFT JOIN participants p ON p.id = pt.participant_id
  LEFT JOIN actions a      ON a.id = pt.action_id
  WHERE pt.id = p_transaction_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'SCAN_NOT_FOUND';
  END IF;

  IF NOT (
    public.is_event_owner(v_event_id)
    OR EXISTS (
      SELECT 1 FROM event_collaborators
      WHERE event_id = v_event_id AND user_id = auth.uid()
    )
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: no access to this event';
  END IF;

  SELECT COALESCE(SUM(points), 0)
  INTO v_current
  FROM point_transactions
  WHERE event_id = v_event_id AND participant_id = v_participant_id;

  v_new := v_current - v_points;

  SELECT COALESCE(jsonb_agg(entry ORDER BY reward_name), '[]'::jsonb)
  INTO v_rewards
  FROM (
    SELECT
      r.name AS reward_name,
      jsonb_build_object(
        'reward_id',       r.id,
        'reward_name',     r.name,
        'required_points', r.required_points,
        'winner_mode',     r.winner_mode,
        'awarded_at',      pr.awarded_at,
        -- Only a 'first' reward can be passed on; an open reward is simply
        -- re-earned by whoever crosses the threshold.
        'next_winner', CASE
          WHEN r.winner_mode = 'first'
          THEN public.next_reward_winner(v_event_id, r.id, p_transaction_id, v_participant_id)
          ELSE NULL
        END
      ) AS entry
    FROM participant_rewards pr
    JOIN rewards r ON r.id = pr.reward_id
    WHERE pr.event_id = v_event_id
      AND pr.participant_id = v_participant_id
      AND r.required_points > v_new
  ) revoked;

  RETURN jsonb_build_object(
    'transaction_id',   p_transaction_id,
    'event_id',         v_event_id,
    'participant_id',   v_participant_id,
    'participant_name', v_participant_name,
    'action_name',      v_action_name,
    'deleted_points',   v_points,
    'current_total',    v_current,
    'new_total',        v_new,
    'revoked_rewards',  v_rewards
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_delete_event_scan(UUID) TO authenticated;
