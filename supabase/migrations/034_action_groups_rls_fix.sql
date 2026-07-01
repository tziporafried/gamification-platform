-- Migration 034: Fix action_groups RLS INSERT permissions
--
-- Problem: FOR ALL USING policies lack explicit WITH CHECK, which can cause
-- INSERT to fail depending on PostgreSQL/Supabase version behavior.
-- Also: no super-admin management policy, so super admins can't insert
-- action_groups for draft events owned by a different super admin.

-- ============================================================
-- Re-create owner management policy with explicit WITH CHECK
-- ============================================================
DROP POLICY IF EXISTS "Users can manage action_groups for their events" ON action_groups;

CREATE POLICY "Users can manage action_groups for their events"
  ON action_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM actions a
      JOIN events e ON e.id = a.event_id
      WHERE a.id = action_groups.action_id
        AND e.owner_admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM actions a
      JOIN events e ON e.id = a.event_id
      WHERE a.id = action_groups.action_id
        AND e.owner_admin_id = auth.uid()
    )
  );

-- ============================================================
-- Super admins can manage action_groups for any event
-- (needed for cross-owner template draft editing)
-- ============================================================
DROP POLICY IF EXISTS "Super admins can manage all action_groups" ON action_groups;

CREATE POLICY "Super admins can manage all action_groups"
  ON action_groups FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================
-- Re-create collaborator management policy with explicit WITH CHECK
-- ============================================================
DROP POLICY IF EXISTS "Collaborators can manage shared event action_groups" ON action_groups;

CREATE POLICY "Collaborators can manage shared event action_groups"
  ON action_groups FOR ALL
  USING (
    action_id IN (
      SELECT a.id FROM actions a
      WHERE a.event_id IN (
        SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    action_id IN (
      SELECT a.id FROM actions a
      WHERE a.event_id IN (
        SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()
      )
    )
  );
