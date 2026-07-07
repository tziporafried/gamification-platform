-- Migration 046: Reward targeting and winner mode
--
-- target_type:
--   all         — open to every participant (default)
--   groups      — restricted via reward_groups junction
--   participant — restricted to a single participant
--
-- winner_mode:
--   all   — every eligible participant who reaches the threshold wins (default)
--   first — only the first eligible participant to reach the threshold wins

ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'all'
    CHECK (target_type IN ('all', 'groups', 'participant')),
  ADD COLUMN IF NOT EXISTS target_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winner_mode TEXT NOT NULL DEFAULT 'all'
    CHECK (winner_mode IN ('all', 'first'));

CREATE INDEX IF NOT EXISTS idx_rewards_target_participant ON rewards(target_participant_id)
  WHERE target_participant_id IS NOT NULL;

-- Backfill: existing group-restricted rewards become target_type = 'groups'
UPDATE rewards r
SET target_type = 'groups'
WHERE EXISTS (
  SELECT 1 FROM reward_groups rg WHERE rg.reward_id = r.id
);

CREATE OR REPLACE FUNCTION check_reward_target_participant_same_event()
RETURNS TRIGGER AS $$
DECLARE
  p_event_id UUID;
BEGIN
  IF NEW.target_participant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT event_id INTO p_event_id FROM participants WHERE id = NEW.target_participant_id;

  IF NEW.event_id IS DISTINCT FROM p_event_id THEN
    RAISE EXCEPTION 'Reward target participant must belong to the same event';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rewards_target_participant_same_event ON rewards;
CREATE TRIGGER rewards_target_participant_same_event
  BEFORE INSERT OR UPDATE OF target_participant_id ON rewards
  FOR EACH ROW
  EXECUTE FUNCTION check_reward_target_participant_same_event();

-- Must drop first: return type changed when out_reward_description was removed (043/044).
DROP FUNCTION IF EXISTS check_and_award_rewards(UUID);

CREATE FUNCTION check_and_award_rewards(p_participant_id UUID)
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
  SELECT event_id INTO v_event_id
  FROM participants
  WHERE id = p_participant_id;

  IF v_event_id IS NULL THEN
    RETURN;
  END IF;

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
      AND r.required_points <= v_total_points
      AND NOT EXISTS (
        SELECT 1 FROM participant_rewards pr
        WHERE pr.participant_id = p_participant_id
          AND pr.reward_id = r.id
      )
      AND (
        r.target_type = 'all'
        OR (
          r.target_type = 'participant'
          AND r.target_participant_id = p_participant_id
        )
        OR (
          r.target_type = 'groups'
          AND EXISTS (
            SELECT 1 FROM reward_groups rg
            JOIN participant_groups pg ON pg.group_id = rg.group_id
            WHERE rg.reward_id = r.id
              AND pg.participant_id = p_participant_id
          )
        )
      )
      AND (
        r.winner_mode = 'all'
        OR NOT EXISTS (
          SELECT 1 FROM participant_rewards pr2
          WHERE pr2.reward_id = r.id
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
