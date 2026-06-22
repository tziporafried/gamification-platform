-- Migration 012: Event Collaborators (share event with another user by email)

-- ============================================================
-- EVENT_COLLABORATORS TABLE
-- ============================================================
CREATE TABLE event_collaborators (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  added_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_event_collaborators_user ON event_collaborators(user_id);

-- ============================================================
-- HELPER: bypasses RLS to avoid recursion between events <-> event_collaborators
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_event_owner(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS 'SELECT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND owner_admin_id = auth.uid())';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE event_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view collaborators"
  ON event_collaborators FOR SELECT
  USING (public.is_event_owner(event_id));

CREATE POLICY "Collaborators can view own entries"
  ON event_collaborators FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners can add collaborators"
  ON event_collaborators FOR INSERT
  WITH CHECK (public.is_event_owner(event_id));

CREATE POLICY "Owners can remove collaborators"
  ON event_collaborators FOR DELETE
  USING (public.is_event_owner(event_id));

-- ============================================================
-- COLLABORATOR ACCESS: additive SELECT policies on all tables
-- Postgres ORs multiple policies, so these extend existing owner policies.
-- ============================================================

-- events
CREATE POLICY "Collaborators can view shared events"
  ON events FOR SELECT
  USING (id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

-- groups
CREATE POLICY "Collaborators can view shared event groups"
  ON groups FOR SELECT
  USING (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

CREATE POLICY "Collaborators can manage shared event groups"
  ON groups FOR ALL
  USING (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

-- participants
CREATE POLICY "Collaborators can view shared event participants"
  ON participants FOR SELECT
  USING (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

CREATE POLICY "Collaborators can manage shared event participants"
  ON participants FOR ALL
  USING (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

-- participant_groups
CREATE POLICY "Collaborators can view shared event assignments"
  ON participant_groups FOR SELECT
  USING (
    participant_id IN (
      SELECT p.id FROM participants p
      WHERE p.event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Collaborators can manage shared event assignments"
  ON participant_groups FOR ALL
  USING (
    participant_id IN (
      SELECT p.id FROM participants p
      WHERE p.event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
    )
  );

-- actions
CREATE POLICY "Collaborators can view shared event actions"
  ON actions FOR SELECT
  USING (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

CREATE POLICY "Collaborators can manage shared event actions"
  ON actions FOR ALL
  USING (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

-- point_transactions
CREATE POLICY "Collaborators can view shared event transactions"
  ON point_transactions FOR SELECT
  USING (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

CREATE POLICY "Collaborators can create shared event transactions"
  ON point_transactions FOR INSERT
  WITH CHECK (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

-- rewards
CREATE POLICY "Collaborators can view shared event rewards"
  ON rewards FOR SELECT
  USING (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

CREATE POLICY "Collaborators can manage shared event rewards"
  ON rewards FOR ALL
  USING (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

-- reward_groups
CREATE POLICY "Collaborators can view shared event reward_groups"
  ON reward_groups FOR SELECT
  USING (
    reward_id IN (
      SELECT r.id FROM rewards r
      WHERE r.event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Collaborators can manage shared event reward_groups"
  ON reward_groups FOR ALL
  USING (
    reward_id IN (
      SELECT r.id FROM rewards r
      WHERE r.event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
    )
  );

-- participant_rewards
CREATE POLICY "Collaborators can view shared event participant_rewards"
  ON participant_rewards FOR SELECT
  USING (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

CREATE POLICY "Collaborators can create shared event participant_rewards"
  ON participant_rewards FOR INSERT
  WITH CHECK (event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));

-- action_groups (conditional)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'action_groups') THEN
    EXECUTE $p$
      CREATE POLICY "Collaborators can view shared event action_groups"
        ON action_groups FOR SELECT
        USING (
          action_id IN (
            SELECT a.id FROM actions a
            WHERE a.event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
          )
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "Collaborators can manage shared event action_groups"
        ON action_groups FOR ALL
        USING (
          action_id IN (
            SELECT a.id FROM actions a
            WHERE a.event_id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid())
          )
        )
    $p$;
  END IF;
END $$;

-- ============================================================
-- RPC: Check if an event slug exists (no data exposed)
-- ============================================================
CREATE OR REPLACE FUNCTION check_event_slug_exists(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS 'SELECT EXISTS (SELECT 1 FROM public.events WHERE slug = p_slug)';

-- ============================================================
-- RPC: Share event with a user by email
-- ============================================================
CREATE OR REPLACE FUNCTION share_event_by_email(p_event_id UUID, p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_target_id UUID;
  v_owner_id UUID;
BEGIN
  SELECT owner_admin_id INTO v_owner_id
  FROM events WHERE id = p_event_id;

  IF v_owner_id IS NULL OR v_owner_id != auth.uid() THEN
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
-- RPC: Get collaborators for an event
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
    AND (
      EXISTS (SELECT 1 FROM events e WHERE e.id = p_event_id AND e.owner_admin_id = auth.uid())
      OR ec.user_id = auth.uid()
    )
  ORDER BY ec.created_at;
END;
$$;
