-- Phase X: Rewards System
-- Run after 005_auto_codes_remove_email.sql in Supabase SQL Editor

-- ============================================================
-- REWARDS
-- ============================================================
CREATE TABLE rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  required_points INTEGER NOT NULL CHECK (required_points > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rewards_event_name ON rewards(event_id, name);
CREATE INDEX idx_rewards_event_id ON rewards(event_id);

CREATE TRIGGER rewards_updated_at
  BEFORE UPDATE ON rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- REWARD_GROUPS (junction — group eligibility)
-- No rows = global reward (available to all participants)
-- ============================================================
CREATE TABLE reward_groups (
  reward_id UUID REFERENCES rewards(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reward_id, group_id)
);

CREATE INDEX idx_reward_groups_group_id ON reward_groups(group_id);

CREATE OR REPLACE FUNCTION check_reward_group_same_event()
RETURNS TRIGGER AS $$
DECLARE
  r_event_id UUID;
  g_event_id UUID;
BEGIN
  SELECT event_id INTO r_event_id FROM rewards WHERE id = NEW.reward_id;
  SELECT event_id INTO g_event_id FROM groups WHERE id = NEW.group_id;

  IF r_event_id IS DISTINCT FROM g_event_id THEN
    RAISE EXCEPTION 'Reward and group must belong to the same event';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reward_groups_same_event
  BEFORE INSERT ON reward_groups
  FOR EACH ROW
  EXECUTE FUNCTION check_reward_group_same_event();

-- ============================================================
-- PARTICIPANT_REWARDS (awarded rewards log)
-- ============================================================
CREATE TABLE participant_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  reward_id UUID REFERENCES rewards(id) ON DELETE CASCADE NOT NULL,
  score_at_award INTEGER NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT participant_rewards_unique UNIQUE (participant_id, reward_id)
);

CREATE INDEX idx_participant_rewards_event ON participant_rewards(event_id);
CREATE INDEX idx_participant_rewards_participant ON participant_rewards(participant_id);

CREATE OR REPLACE FUNCTION check_participant_reward_same_event()
RETURNS TRIGGER AS $$
DECLARE
  p_event_id UUID;
  r_event_id UUID;
BEGIN
  SELECT event_id INTO p_event_id FROM participants WHERE id = NEW.participant_id;
  SELECT event_id INTO r_event_id FROM rewards WHERE id = NEW.reward_id;

  IF p_event_id IS DISTINCT FROM NEW.event_id OR r_event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'Participant and reward must belong to the same event';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER participant_rewards_same_event
  BEFORE INSERT ON participant_rewards
  FOR EACH ROW
  EXECUTE FUNCTION check_participant_reward_same_event();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- REWARDS
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own event rewards"
  ON rewards FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can create rewards for own event"
  ON rewards FOR INSERT
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can update own event rewards"
  ON rewards FOR UPDATE
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can delete own event rewards"
  ON rewards FOR DELETE
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

-- REWARD_GROUPS
ALTER TABLE reward_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own event reward groups"
  ON reward_groups FOR SELECT
  USING (
    reward_id IN (
      SELECT id FROM rewards
      WHERE event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid())
    )
  );

CREATE POLICY "Admins can create reward groups for own event"
  ON reward_groups FOR INSERT
  WITH CHECK (
    reward_id IN (
      SELECT id FROM rewards
      WHERE event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid())
    )
  );

CREATE POLICY "Admins can delete own event reward groups"
  ON reward_groups FOR DELETE
  USING (
    reward_id IN (
      SELECT id FROM rewards
      WHERE event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid())
    )
  );

-- PARTICIPANT_REWARDS
ALTER TABLE participant_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own event participant rewards"
  ON participant_rewards FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can create participant rewards for own event"
  ON participant_rewards FOR INSERT
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

-- ============================================================
-- RPC: CHECK AND AWARD REWARDS
-- Atomically checks eligibility and inserts new awards.
-- SECURITY INVOKER ensures RLS remains active.
-- ============================================================
CREATE OR REPLACE FUNCTION check_and_award_rewards(p_participant_id UUID)
RETURNS TABLE (
  out_reward_id UUID,
  out_reward_name TEXT,
  out_reward_description TEXT,
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
    SELECT r.id, r.name, r.description, r.required_points
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
  SELECT ne.id, ne.name, ne.description, ne.required_points, v_total_points
  FROM newly_eligible ne
  WHERE ne.id IN (SELECT ins.reward_id FROM inserted ins);
END;
$$;
