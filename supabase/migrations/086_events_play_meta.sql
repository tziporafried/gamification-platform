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
-- Deliberately NOT security definer. Counts are as sensitive as the rows they
-- count, and invoker rights mean the existing SELECT policies decide what is
-- visible: an owner sees their own events, a collaborator the events shared
-- with them, a super admin all of them. An event the caller cannot read simply
-- comes back with no row, exactly as the old per-table selects behaved.

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
