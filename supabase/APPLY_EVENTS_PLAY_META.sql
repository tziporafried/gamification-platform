-- Apply on remote if migrations are not auto-run:
--   Supabase SQL editor - paste this file, run once.
-- Idempotent: CREATE OR REPLACE, safe to re-run.
--
-- Source: migrations/086_events_play_meta.sql
-- Fixes: an event with tasks showing 0 in the משימות column of the admin events
-- table (and the same for the other four count columns). Until this runs the
-- client counts the rows itself, page by page, which is correct but pulls every
-- participant and every scan of every listed event over the wire to do it.

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
SET search_path = public, pg_temp
AS $$
  SELECT
    e.id,
    (SELECT count(*) FROM participants        p WHERE p.event_id = e.id),
    (SELECT count(*) FROM groups              g WHERE g.event_id = e.id),
    (SELECT count(*) FROM actions             a WHERE a.event_id = e.id),
    (SELECT count(*) FROM rewards             r WHERE r.event_id = e.id),
    (SELECT count(*) FROM point_transactions  t WHERE t.event_id = e.id)
  FROM events e
  WHERE e.id = ANY(p_event_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_events_play_meta(UUID[]) TO authenticated;
