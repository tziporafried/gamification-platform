-- Migration 017: Allow collaborators to share events with others

-- ============================================================
-- HELPER: check if current user can manage an event (owner OR collaborator)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND owner_admin_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.event_collaborators WHERE event_id = p_event_id AND user_id = auth.uid())
$$;

-- ============================================================
-- RLS: allow collaborators to add/remove collaborators
-- ============================================================
DROP POLICY IF EXISTS "Owners can add collaborators" ON event_collaborators;
CREATE POLICY "Owners and collaborators can add collaborators"
  ON event_collaborators FOR INSERT
  WITH CHECK (public.can_manage_event(event_id));

DROP POLICY IF EXISTS "Owners can remove collaborators" ON event_collaborators;
CREATE POLICY "Owners and collaborators can remove collaborators"
  ON event_collaborators FOR DELETE
  USING (public.can_manage_event(event_id));

DROP POLICY IF EXISTS "Owners can view collaborators" ON event_collaborators;
CREATE POLICY "Owners and collaborators can view collaborators"
  ON event_collaborators FOR SELECT
  USING (public.can_manage_event(event_id));

-- ============================================================
-- RPC: Update share_event_by_email to allow owners AND collaborators
-- ============================================================
CREATE OR REPLACE FUNCTION share_event_by_email(p_event_id UUID, p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_target_id UUID;
BEGIN
  IF NOT public.can_manage_event(p_event_id) THEN
    RETURN json_build_object('error', 'NOT_OWNER');
  END IF;

  SELECT up.id INTO v_target_id
  FROM user_profiles up
  WHERE LOWER(up.email) = LOWER(p_email);

  IF v_target_id IS NULL THEN
    RETURN json_build_object('error', 'USER_NOT_FOUND');
  END IF;

  IF v_target_id = auth.uid() THEN
    RETURN json_build_object('error', 'CANNOT_SHARE_SELF');
  END IF;

  INSERT INTO event_collaborators (event_id, user_id, added_by)
  VALUES (p_event_id, v_target_id, auth.uid())
  ON CONFLICT (event_id, user_id) DO NOTHING;

  RETURN json_build_object('success', true, 'user_id', v_target_id);
END;
$$;

-- ============================================================
-- RPC: Update get_event_collaborators so any collaborator sees the full list
-- ============================================================
CREATE OR REPLACE FUNCTION get_event_collaborators(p_event_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.can_manage_event(p_event_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ec.user_id,
    up.email,
    up.display_name,
    up.avatar_url,
    ec.created_at
  FROM event_collaborators ec
  JOIN user_profiles up ON up.id = ec.user_id
  WHERE ec.event_id = p_event_id
  ORDER BY ec.created_at;
END;
$$;
