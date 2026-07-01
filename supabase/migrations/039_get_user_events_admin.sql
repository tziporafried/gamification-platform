-- Migration 039: Admin RPC to fetch all events for a specific user
-- Used by the admin panel customers tab for per-event plan management

CREATE OR REPLACE FUNCTION get_user_events_admin(p_user_id UUID)
RETURNS TABLE (
  event_id    UUID,
  event_name  TEXT,
  plan        TEXT,
  status      TEXT,
  created_at  TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles up2
    WHERE up2.id = auth.uid() AND up2.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  RETURN QUERY
  SELECT e.id, e.name, e.plan, e.status::TEXT, e.created_at
  FROM events e
  WHERE e.owner_admin_id = p_user_id
    AND e.status != 'archived'
  ORDER BY e.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
