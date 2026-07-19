-- Migration 067: Align get_all_users_admin event_count with the customers list.
-- Archived events are soft-deleted and already excluded from get_user_events_admin;
-- counting them made the badge show a higher number than the expanded list.

DROP FUNCTION IF EXISTS get_all_users_admin();
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE (
  user_id                 UUID,
  email                   TEXT,
  display_name            TEXT,
  avatar_url              TEXT,
  role                    TEXT,
  created_at              TIMESTAMPTZ,
  last_sign_in_at         TIMESTAMPTZ,
  event_count             BIGINT,
  event_names             TEXT,
  affiliate_attribution   JSONB
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
    au.last_sign_in_at,
    COALESCE(ev.cnt, 0)    AS event_count,
    COALESCE(ev.names, '') AS event_names,
    up.affiliate_attribution
  FROM user_profiles up
  LEFT JOIN auth.users au ON au.id = up.id
  LEFT JOIN (
    SELECT
      owner_admin_id,
      COUNT(*)::BIGINT AS cnt,
      STRING_AGG(e.name, ', ' ORDER BY e.created_at DESC)
        FILTER (WHERE e.name IS NOT NULL AND TRIM(e.name) != '') AS names
    FROM events e
    WHERE e.status != 'archived'
    GROUP BY owner_admin_id
  ) ev ON ev.owner_admin_id = up.id
  ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
