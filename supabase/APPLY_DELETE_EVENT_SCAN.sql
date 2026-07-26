-- Apply on remote if migrations are not auto-run:
--   Supabase SQL editor - paste this file, run once.
-- Idempotent: CREATE OR REPLACE throughout, safe to re-run.
--
-- Source: migrations/074_delete_event_scan.sql
-- Needed by: the management popup's scan delete (preview + transfer of a
-- 'first winner' prize). Until this runs, the delete fails online; the offline
-- player does not need it.

-- Migration 074: Delete a single scan from the management screen, with an
-- explicit decision about the rewards that deletion knocks out.
-- Run in the Supabase SQL Editor.
--
-- point_transactions is an append-only log: 003 installed a BEFORE DELETE
-- trigger that rejects every delete, and there is no DELETE policy on the
-- table. Removing one mistaken scan therefore has to go through a function,
-- the same way the super-admin wipe (064) does - session_replication_role =
-- replica suspends the immutability trigger for this statement only.
--
-- SECURITY DEFINER to get past the missing DELETE policy; access is checked
-- explicitly against the same rule the SELECT policies use (owner,
-- collaborator, or super admin).
--
-- Three functions, because the operator has to see the consequences first:
--
--   next_reward_winner        - who a 'first' reward should pass to
--   preview_delete_event_scan - read-only: what this delete would do
--   delete_event_scan         - does it, carrying out the chosen transfers
--
-- Two deliberate asymmetries with a plain delete:
--
--   * events.trial_scans_used is NOT decremented. 055 defines it as the
--     lifetime trial quota that "survives deleting trial data" - refunding a
--     scan here would turn the management screen into a way to reset the trial.
--   * rewards the participant no longer qualifies for are revoked. Awards are
--     handed out by check_and_award_rewards the moment the total crosses the
--     threshold, so leaving them behind after the total drops would show a
--     prize the leaderboard says was never earned.

-- ============================================================
-- WHO A 'first' REWARD SHOULD PASS TO
-- ============================================================
-- participant_rewards is a log, not a live calculation: check_and_award_rewards
-- only ever runs for the participant who just scanned, and winner_mode = 'first'
-- is locked by the mere existence of a row. So once a "first winner" row is
-- revoked, the prize would otherwise fall to whoever happens to scan next.
--
-- The rightful next winner is the eligible participant who reached the
-- threshold EARLIEST - replayed from the transaction log, with the scan being
-- deleted taken out - and who is still above it. NULL when there is no such
-- participant.
-- Not SECURITY DEFINER on purpose: it is a helper for the two functions below
-- and runs with their rights when they call it. Called directly by a user it
-- stays behind that user's RLS.
CREATE OR REPLACE FUNCTION public.next_reward_winner(
  p_event_id             UUID,
  p_reward_id            UUID,
  p_exclude_tx           UUID,
  p_exclude_participant  UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH r AS (
    SELECT * FROM rewards WHERE id = p_reward_id
  ),
  eligible AS (
    SELECT p.id, p.name
    FROM participants p, r
    WHERE p.event_id = p_event_id
      AND p.id IS DISTINCT FROM p_exclude_participant
      -- Same targeting rules as check_and_award_rewards (046).
      AND (
        r.target_type = 'all'
        OR (r.target_type = 'participant' AND r.target_participant_id = p.id)
        OR (
          r.target_type = 'groups'
          AND EXISTS (
            SELECT 1 FROM reward_groups rg
            JOIN participant_groups pg ON pg.group_id = rg.group_id
            WHERE rg.reward_id = r.id AND pg.participant_id = p.id
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM participant_rewards pr
        WHERE pr.reward_id = p_reward_id AND pr.participant_id = p.id
      )
  ),
  running AS (
    SELECT
      pt.participant_id,
      pt.created_at,
      SUM(pt.points) OVER (
        PARTITION BY pt.participant_id ORDER BY pt.created_at, pt.id
      ) AS running_total
    FROM point_transactions pt
    WHERE pt.event_id = p_event_id
      AND pt.id IS DISTINCT FROM p_exclude_tx
      AND pt.participant_id IN (SELECT id FROM eligible)
  ),
  crossed AS (
    SELECT running.participant_id, MIN(running.created_at) AS crossed_at
    FROM running, r
    WHERE running.running_total >= r.required_points
    GROUP BY running.participant_id
  ),
  totals AS (
    SELECT pt.participant_id, SUM(pt.points) AS total
    FROM point_transactions pt
    WHERE pt.event_id = p_event_id
      AND pt.id IS DISTINCT FROM p_exclude_tx
    GROUP BY pt.participant_id
  )
  SELECT jsonb_build_object(
    'participant_id', e.id,
    'name',           e.name,
    'total_points',   t.total,
    'crossed_at',     c.crossed_at
  )
  FROM crossed c
  JOIN eligible e ON e.id = c.participant_id
  JOIN totals   t ON t.participant_id = e.id
  CROSS JOIN r
  -- Crossed it once AND is still above it: the two only differ if a scan of
  -- theirs is ever deleted too, but the prize should follow the current standing.
  WHERE t.total >= r.required_points
  ORDER BY c.crossed_at ASC, e.name ASC
  LIMIT 1;
$$;

-- ============================================================
-- WHAT THIS DELETE WOULD DO (read-only)
-- ============================================================
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
  SELECT pt.event_id, pt.participant_id, pt.points, p.name, a.name
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
        -- re-earned by whoever crosses the threshold, including this
        -- participant on their next scan.
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

-- ============================================================
-- THE DELETE
-- ============================================================
-- p_transfers: [{ "reward_id": UUID, "participant_id": UUID }] - the transfers
-- the operator approved in the preview. Anything not listed stays unclaimed.
-- A transfer that no longer holds (someone scanned in between, say) aborts the
-- whole call rather than quietly handing the prize to nobody.
DROP FUNCTION IF EXISTS public.delete_event_scan(UUID);

CREATE OR REPLACE FUNCTION public.delete_event_scan(
  p_transaction_id UUID,
  p_transfers      JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id       UUID;
  v_participant_id UUID;
  v_points         INTEGER;
  v_total          BIGINT;
  v_revoked        JSONB := '[]'::jsonb;
  v_reward         RECORD;
  v_transfer_to    UUID;
  v_next           JSONB;
  v_new_name       TEXT;
  v_new_total      BIGINT;
BEGIN
  SELECT event_id, participant_id, points
  INTO v_event_id, v_participant_id, v_points
  FROM point_transactions
  WHERE id = p_transaction_id;

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

  -- Bypass the append-only trigger for this one row (same pattern as
  -- admin_reset_event_scans); restored immediately after.
  SET LOCAL session_replication_role = replica;

  DELETE FROM point_transactions
  WHERE id = p_transaction_id;

  SET LOCAL session_replication_role = DEFAULT;

  SELECT COALESCE(SUM(points), 0)
  INTO v_total
  FROM point_transactions
  WHERE event_id = v_event_id
    AND participant_id = v_participant_id;

  -- Revoke, one reward at a time, so each one can carry its own outcome back.
  FOR v_reward IN
    SELECT r.id, r.name, r.required_points, r.winner_mode
    FROM participant_rewards pr
    JOIN rewards r ON r.id = pr.reward_id
    WHERE pr.event_id = v_event_id
      AND pr.participant_id = v_participant_id
      AND r.required_points > v_total
    ORDER BY r.name
  LOOP
    DELETE FROM participant_rewards
    WHERE event_id = v_event_id
      AND participant_id = v_participant_id
      AND reward_id = v_reward.id;

    SELECT (t->>'participant_id')::UUID
    INTO v_transfer_to
    FROM jsonb_array_elements(COALESCE(p_transfers, '[]'::jsonb)) AS t
    WHERE (t->>'reward_id')::UUID = v_reward.id
    LIMIT 1;

    v_new_name := NULL;

    IF v_transfer_to IS NOT NULL THEN
      IF v_reward.winner_mode <> 'first' THEN
        RAISE EXCEPTION 'TRANSFER_NOT_FIRST_WINNER: %', v_reward.name;
      END IF;

      -- The transfer has to still be the one the operator was shown: the
      -- rightful next winner, recomputed now. If someone scanned in between and
      -- it changed, the whole call aborts so they can look at it again rather
      -- than hand the prize to the wrong person.
      v_next := public.next_reward_winner(
        v_event_id, v_reward.id, p_transaction_id, v_participant_id
      );

      IF (v_next->>'participant_id')::UUID IS DISTINCT FROM v_transfer_to THEN
        RAISE EXCEPTION 'TRANSFER_NOT_ELIGIBLE: %', v_reward.name;
      END IF;

      v_new_name  := v_next->>'name';
      v_new_total := (v_next->>'total_points')::BIGINT;

      INSERT INTO participant_rewards (event_id, participant_id, reward_id, score_at_award)
      VALUES (v_event_id, v_transfer_to, v_reward.id, v_new_total)
      ON CONFLICT (participant_id, reward_id) DO NOTHING;
    END IF;

    v_revoked := v_revoked || jsonb_build_object(
      'reward_id',      v_reward.id,
      'reward_name',    v_reward.name,
      'winner_mode',    v_reward.winner_mode,
      'transferred_to', CASE
        WHEN v_transfer_to IS NULL THEN NULL
        ELSE jsonb_build_object('participant_id', v_transfer_to, 'name', v_new_name)
      END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'event_id',                 v_event_id,
    'participant_id',           v_participant_id,
    'deleted_points',           v_points,
    'participant_total_points', v_total,
    'revoked_rewards',          v_revoked
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_delete_event_scan(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_event_scan(UUID, JSONB) TO authenticated;
