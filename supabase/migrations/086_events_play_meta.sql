-- Migration 086: count an event's contents in the database, not by fetching it.
--
-- The events tables in the admin panel, the users panel and "my events" all
-- show the same five numbers per event - participants, groups, tasks, rewards,
-- scans - and until now the client produced them by selecting `event_id` from
-- each table for every event at once and counting the rows it got back.
--
-- PostgREST caps a response at 1000 rows. The cap is per request, not per
-- event, so the five requests share one budget across the whole list: once the
-- events on screen hold more than a thousand actions between them, the rows
-- past the cap never arrive and the events they belong to are counted as 0.
-- That is the bug this fixes - a game with tasks showing "0 משימות" purely
-- because other games' tasks filled the response first. Which events get the
-- zero is unspecified, so it also came and went as data was added.
--
-- Counting belongs in SQL anyway: this returns one row per event instead of one
-- row per participant and per scan, which on a busy account is the difference
-- between a few dozen bytes and a few megabytes.
--
-- ------------------------------------------------------------------
-- Why SECURITY DEFINER, and what pays for it
-- ------------------------------------------------------------------
-- Access is checked once per event, in `visible` below, against exactly the
-- rule the SELECT policies use: owner, collaborator, or super admin. Same shape
-- as the check in 074. An event the caller may not read produces no row, and
-- its counts are never computed, because the aggregates below only look at the
-- events `visible` let through.
--
-- Under invoker rights the counts would come out identical, but the policies
-- would be re-checked once per counted row, and "Super admins can view all
-- point_transactions" is USING (public.is_super_admin()) - a SECURITY DEFINER
-- lookup in user_profiles. On an account with 100k scans that is 100k lookups
-- to produce one number. Checking the event once and then counting is the whole
-- point: the five aggregates become plain index-only scans on
-- idx_participants_event_id, idx_groups_event_id, idx_actions_event_id,
-- idx_rewards_event_id and idx_point_transactions_event_created.
--
-- The super-admin test is spelled out here rather than calling is_super_admin()
-- so it stays an uncorrelated EXISTS - evaluated once for the whole call - and
-- so this function does not inherit that helper's VOLATILE, PARALLEL UNSAFE
-- declaration. Inside a definer function the read needs no policy help anyway.

DROP FUNCTION IF EXISTS public.get_events_play_meta(UUID[]);

CREATE OR REPLACE FUNCTION public.get_events_play_meta(p_event_ids UUID[])
RETURNS TABLE (
  event_id     UUID,
  participants BIGINT,
  groups       BIGINT,
  tasks        BIGINT,
  rewards      BIGINT,
  transactions BIGINT
)
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH visible AS (
    SELECT e.id
    FROM events e
    WHERE e.id = ANY(p_event_ids)
      AND (
        e.owner_admin_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid() AND up.role = 'super_admin'
        )
        OR EXISTS (
          SELECT 1 FROM event_collaborators c
          WHERE c.event_id = e.id AND c.user_id = auth.uid()
        )
      )
  ),
  n_participants AS (
    SELECT p.event_id AS id, count(*) AS n
    FROM participants p
    WHERE p.event_id IN (SELECT id FROM visible)
    GROUP BY p.event_id
  ),
  n_groups AS (
    SELECT g.event_id AS id, count(*) AS n
    FROM groups g
    WHERE g.event_id IN (SELECT id FROM visible)
    GROUP BY g.event_id
  ),
  n_tasks AS (
    SELECT a.event_id AS id, count(*) AS n
    FROM actions a
    WHERE a.event_id IN (SELECT id FROM visible)
    GROUP BY a.event_id
  ),
  n_rewards AS (
    SELECT r.event_id AS id, count(*) AS n
    FROM rewards r
    WHERE r.event_id IN (SELECT id FROM visible)
    GROUP BY r.event_id
  ),
  n_scans AS (
    SELECT t.event_id AS id, count(*) AS n
    FROM point_transactions t
    WHERE t.event_id IN (SELECT id FROM visible)
    GROUP BY t.event_id
  )
  SELECT
    v.id,
    COALESCE(np.n, 0),
    COALESCE(ng.n, 0),
    COALESCE(na.n, 0),
    COALESCE(nr.n, 0),
    COALESCE(ns.n, 0)
  FROM visible v
  LEFT JOIN n_participants np ON np.id = v.id
  LEFT JOIN n_groups       ng ON ng.id = v.id
  LEFT JOIN n_tasks        na ON na.id = v.id
  LEFT JOIN n_rewards      nr ON nr.id = v.id
  LEFT JOIN n_scans        ns ON ns.id = v.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_events_play_meta(UUID[]) TO authenticated;
