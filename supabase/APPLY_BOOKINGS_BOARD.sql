-- Apply on remote if migrations are not auto-run:
--   psql / Supabase SQL editor - paste this file
-- Idempotent where possible.

ALTER TABLE scanner_bookings
  ALTER COLUMN scanner_id DROP NOT NULL;

COMMENT ON COLUMN scanner_bookings.scanner_id IS
  'Optional physical scanner. NULL = booking without hardware (game / calendar only).';

COMMENT ON COLUMN scanner_bookings.event_id IS
  'Linked game event (events.id) for this booking.';

CREATE OR REPLACE FUNCTION admin_reset_event_scans(p_event_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tx_count INTEGER := 0;
  v_reward_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  SET LOCAL session_replication_role = replica;

  DELETE FROM participant_rewards
  WHERE event_id = p_event_id;
  GET DIAGNOSTICS v_reward_count = ROW_COUNT;

  DELETE FROM point_transactions
  WHERE event_id = p_event_id;
  GET DIAGNOSTICS v_tx_count = ROW_COUNT;

  SET LOCAL session_replication_role = DEFAULT;

  UPDATE events
  SET trial_scans_used = 0,
      updated_at = now()
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'deleted_transactions', v_tx_count,
    'deleted_rewards', v_reward_count,
    'trial_scans_used', 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_reset_event_scans(UUID) TO authenticated;
