-- Migration 048: Admin RPC to fully delete a user and all their data.
-- Used by the admin panel customers tab. Deleting the auth.users row cascades
-- to user_profiles, events (owner_admin_id ON DELETE CASCADE) and, through the
-- event cascade, to every event-scoped table (groups, participants, actions,
-- point_transactions, rewards, event_collaborators, contact_upgrade_requests).

CREATE OR REPLACE FUNCTION delete_user_admin(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Only super admins may delete users
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  -- Guard: never delete your own account
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Guard: never delete another super admin
  IF EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = p_user_id AND up.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Cannot delete a super admin';
  END IF;

  -- Reassign the few NOT NULL, non-cascading audit references this user may
  -- hold in OTHER people's data (rows in the user's own events are removed by
  -- the event cascade below, so these updates only touch surviving rows).
  -- Without this the auth.users delete would fail on a foreign key.
  UPDATE point_transactions   SET created_by = auth.uid() WHERE created_by = p_user_id;
  UPDATE event_collaborators  SET added_by  = auth.uid() WHERE added_by  = p_user_id;
  UPDATE dev_todos            SET created_by = auth.uid() WHERE created_by = p_user_id;

  -- Cascades handle everything else.
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
