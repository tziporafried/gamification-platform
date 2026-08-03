-- Migration 091: Admin RPC to delete a single game and everything hanging off
-- it. Used by the admin panel's events tab, where until now the only way to get
-- rid of one game was to delete its owner (048) with all their other games.
-- Run in the Supabase SQL Editor.
--
-- Two reasons this cannot be a plain DELETE from the client:
--
--   * events has no DELETE policy at all, so RLS rejects it outright.
--   * point_transactions is append-only - 003 installed a BEFORE DELETE trigger
--     that raises. Row triggers fire on cascading deletes too, so the events
--     delete would abort the moment the game had a single scan.
--
-- So the log is cleared first under session_replication_role = replica (the
-- same escape hatch admin_reset_event_scans (064) and delete_event_scan (074)
-- use), and the events row is deleted afterwards with the triggers back on.
-- participant_rewards is cleared in the same breath, purely so the number of
-- revoked prizes can be reported; the cascade would have taken it anyway.
--
-- Everything else is left to the cascades declared on events(id): groups,
-- participants, participant_groups, actions, action_groups, action_options,
-- rewards, reward_groups, event_collaborators, event_features, lottery_draws
-- and the trivia tables. Three references deliberately survive as NULL rather
-- than take their row with them:
--
--   templates.draft_event_id          - the template outlives its draft
--   contact_upgrade_requests.event_id - the lead outlives the game
--   scanner_bookings.event_id         - the booking is a finance record
--
-- The counts come back so the caller can report what was actually removed.

CREATE OR REPLACE FUNCTION public.delete_event_admin(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name         TEXT;
  v_groups       INTEGER;
  v_participants INTEGER;
  v_actions      INTEGER;
  v_rewards      INTEGER;
  v_bookings     INTEGER;
  v_awards       INTEGER := 0;
  v_scans        INTEGER := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  SELECT name INTO v_name FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;

  -- Counted before the delete, so the caller can say what it removed.
  SELECT count(*) INTO v_groups       FROM groups       WHERE event_id = p_event_id;
  SELECT count(*) INTO v_participants FROM participants WHERE event_id = p_event_id;
  SELECT count(*) INTO v_actions      FROM actions      WHERE event_id = p_event_id;
  SELECT count(*) INTO v_rewards      FROM rewards      WHERE event_id = p_event_id;
  SELECT count(*) INTO v_bookings     FROM scanner_bookings WHERE event_id = p_event_id;

  -- Append-only log first, with the immutability trigger suspended.
  SET LOCAL session_replication_role = replica;

  DELETE FROM participant_rewards WHERE event_id = p_event_id;
  GET DIAGNOSTICS v_awards = ROW_COUNT;

  DELETE FROM point_transactions WHERE event_id = p_event_id;
  GET DIAGNOSTICS v_scans = ROW_COUNT;

  SET LOCAL session_replication_role = DEFAULT;

  -- Cascades handle the rest.
  DELETE FROM events WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'event_id',          p_event_id,
    'event_name',        v_name,
    'groups',            v_groups,
    'participants',      v_participants,
    'actions',           v_actions,
    'rewards',           v_rewards,
    'awards',            v_awards,
    'scans',             v_scans,
    'bookings_unlinked', v_bookings
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_event_admin(UUID) TO authenticated;
