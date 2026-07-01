-- Migration 038: Clean up event names in get_all_users_admin
-- Remove [plan] tag from event names, skip unnamed events in the name list

DROP FUNCTION IF EXISTS get_all_users_admin();
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE (
  user_id      UUID,
  email        TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  role         TEXT,
  created_at   TIMESTAMPTZ,
  event_count  BIGINT,
  event_names  TEXT
) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles up2
    WHERE up2.id = auth.uid() AND up2.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    up.id          AS user_id,
    up.email,
    up.display_name,
    up.avatar_url,
    up.role,
    up.created_at,
    COALESCE(ev.cnt, 0)    AS event_count,
    COALESCE(ev.names, '') AS event_names
  FROM user_profiles up
  LEFT JOIN (
    SELECT
      owner_admin_id,
      COUNT(*)::BIGINT AS cnt,
      STRING_AGG(e.name, ', ' ORDER BY e.created_at DESC)
        FILTER (WHERE e.name IS NOT NULL AND TRIM(e.name) != '') AS names
    FROM events e
    GROUP BY owner_admin_id
  ) ev ON ev.owner_admin_id = up.id
  ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
