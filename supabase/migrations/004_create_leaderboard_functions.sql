-- Phase 4: Leaderboard RPC Functions
-- Run after 003_create_actions_transactions.sql in Supabase SQL Editor
--
-- SECURITY MODEL:
--   All functions use SECURITY INVOKER. SECURITY DEFINER is prohibited.
--   INVOKER ensures RLS policies remain active for the calling user,
--   enforcing event isolation at the row level. DEFINER would bypass RLS
--   and make the function body the sole security boundary.
--
-- EVENT OWNERSHIP:
--   Functions accept NO event_id parameter. Each function internally
--   resolves the admin's event via auth.uid() against the events table.
--   This assumes the single-event-per-admin invariant enforced by the
--   UNIQUE constraint on events(owner_admin_id).
--
-- DATA MODEL:
--   No new tables. No stored totals. No materialized views.
--   Leaderboards are always computed live from point_transactions.

-- ============================================================
-- PERFORMANCE INDEX
-- Covers the (event_id, participant_id) access pattern used
-- by both leaderboard aggregation queries.
-- ============================================================
CREATE INDEX idx_point_transactions_event_participant
  ON point_transactions(event_id, participant_id);

-- ============================================================
-- PARTICIPANT LEADERBOARD
-- Returns all participants for the calling admin's event,
-- ranked by total points descending, with ties broken by name.
-- Participants with zero transactions appear with total_points = 0.
-- ============================================================
CREATE OR REPLACE FUNCTION get_participant_leaderboard()
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
  SELECT id INTO v_event_id
  FROM events
  WHERE owner_admin_id = auth.uid();

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
-- GROUP LEADERBOARD
-- Returns all groups for the calling admin's event,
-- ranked by aggregate member points descending.
-- A participant in multiple groups contributes points to each.
-- Groups with no members appear with total_points = 0.
-- ============================================================
CREATE OR REPLACE FUNCTION get_group_leaderboard()
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
  SELECT id INTO v_event_id
  FROM events
  WHERE owner_admin_id = auth.uid();

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
