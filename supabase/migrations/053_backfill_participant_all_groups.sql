-- Backfill: a participant must belong to at least one group.
-- Historically participants could be left with no group ("ללא קבוצה"), which also
-- excludes them from every group-restricted action. Assign each ungrouped participant
-- to ALL of their event's groups ("all groups"), the new default.
--
-- Only participants with zero memberships are touched — intentional subsets are left
-- untouched. Events with no groups (group_type 'none') produce no rows via the join.

INSERT INTO public.participant_groups (participant_id, group_id)
SELECT p.id, g.id
FROM public.participants p
JOIN public.groups g ON g.event_id = p.event_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.participant_groups pg
  WHERE pg.participant_id = p.id
)
ON CONFLICT (participant_id, group_id) DO NOTHING;
