-- Migration 044: Fix reward detection for multi-event admins and collaborators
--
-- BUG: check_and_award_rewards previously derived the event by querying
--      `events WHERE owner_admin_id = auth.uid()`. This fails in two cases:
--
--   1. Collaborators: auth.uid() has no owned events → v_event_id = NULL → returns nothing
--   2. Multi-event admins: arbitrary event returned → may not match participant → returns nothing
--
-- FIX: Derive v_event_id from the participant record directly (safe: already
--      guarded by RLS - only owners/collaborators can read their own participants).
--      Security check remains: verifies the caller owns or collaborates on the event.
--
-- The threshold comparison  r.required_points <= v_total_points  is intentionally
-- >=, which correctly awards a reward even when the participant jumps over the
-- exact threshold in a single action (e.g. 2,900 → 3,200 for a 3,000-pt reward).

CREATE OR REPLACE FUNCTION check_and_award_rewards(p_participant_id UUID)
RETURNS TABLE (
  out_reward_id UUID,
  out_reward_name TEXT,
  out_required_points INTEGER,
  out_total_points BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_event_id UUID;
  v_total_points BIGINT;
BEGIN
  -- Derive event from participant (RLS already ensures the caller can only see
  -- participants belonging to their own events or events they collaborate on).
  SELECT event_id INTO v_event_id
  FROM participants
  WHERE id = p_participant_id;

  IF v_event_id IS NULL THEN
    RETURN;
  END IF;

  -- Explicit security check: caller must be the event owner or a collaborator.
  IF NOT EXISTS (
    SELECT 1 FROM events
    WHERE id = v_event_id
      AND owner_admin_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM event_collaborators
    WHERE event_id = v_event_id
      AND user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(pt.points), 0) INTO v_total_points
  FROM point_transactions pt
  WHERE pt.participant_id = p_participant_id
    AND pt.event_id = v_event_id;

  RETURN QUERY
  WITH newly_eligible AS (
    SELECT r.id, r.name, r.required_points
    FROM rewards r
    WHERE r.event_id = v_event_id
      AND r.is_active = true
      AND r.required_points <= v_total_points          -- handles "jump over" correctly
      AND NOT EXISTS (
        SELECT 1 FROM participant_rewards pr
        WHERE pr.participant_id = p_participant_id
          AND pr.reward_id = r.id
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM reward_groups rg WHERE rg.reward_id = r.id
        )
        OR EXISTS (
          SELECT 1 FROM reward_groups rg
          JOIN participant_groups pg ON pg.group_id = rg.group_id
          WHERE rg.reward_id = r.id
            AND pg.participant_id = p_participant_id
        )
      )
  ),
  inserted AS (
    INSERT INTO participant_rewards (event_id, participant_id, reward_id, score_at_award)
    SELECT v_event_id, p_participant_id, ne.id, v_total_points
    FROM newly_eligible ne
    ON CONFLICT (participant_id, reward_id) DO NOTHING
    RETURNING participant_rewards.reward_id
  )
  SELECT ne.id, ne.name, ne.required_points, v_total_points
  FROM newly_eligible ne
  WHERE ne.id IN (SELECT ins.reward_id FROM inserted ins);
END;
$$;
