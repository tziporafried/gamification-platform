-- Remove reward description field and update award RPC

ALTER TABLE rewards DROP COLUMN IF EXISTS description;

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
  v_participant_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM events
  WHERE owner_admin_id = auth.uid();

  IF v_event_id IS NULL THEN
    RETURN;
  END IF;

  SELECT event_id INTO v_participant_event_id
  FROM participants
  WHERE id = p_participant_id;

  IF v_participant_event_id IS DISTINCT FROM v_event_id THEN
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
      AND r.required_points <= v_total_points
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
