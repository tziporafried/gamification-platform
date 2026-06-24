-- Fix leaderboard RPCs for multi-event support.
-- The old functions resolved event via owner_admin_id = auth.uid() which only found one event.
-- New functions accept an explicit event_id parameter.

-- ============================================================
-- PARTICIPANT LEADERBOARD (with event_id parameter)
-- ============================================================
CREATE OR REPLACE FUNCTION get_participant_leaderboard(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  participant_id UUID,
  participant_name TEXT,
  external_id TEXT,
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
    -- Fallback: resolve from owner (backward compat)
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
    p.id AS participant_id,
    p.name AS participant_name,
    p.external_id,
    COALESCE(SUM(pt.points), 0) AS total_points
  FROM participants p
  LEFT JOIN point_transactions pt
    ON pt.participant_id = p.id
    AND pt.event_id = v_event_id
  WHERE p.event_id = v_event_id
  GROUP BY p.id, p.name, p.external_id
  ORDER BY total_points DESC, p.name ASC;
END;
$$;

-- ============================================================
-- GROUP LEADERBOARD (with event_id parameter)
-- ============================================================
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
  GROUP BY g.id, g.name, g.color
  ORDER BY total_points DESC, g.name ASC;
END;
$$;
