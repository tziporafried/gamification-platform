-- Apply on remote if migrations are not auto-run:
--   Supabase SQL editor - paste this file, run once.
-- Idempotent: DROP ... IF EXISTS + CREATE OR REPLACE, safe to re-run.
--
-- Source: migrations/086_events_play_meta.sql
-- Fixes: an event with tasks showing 0 in the משימות column of the admin events
-- table (and the same for the other four count columns). Until this runs the
-- client counts the rows itself, page by page, which is correct but pulls every
-- participant and every scan of every listed event over the wire to do it.

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
