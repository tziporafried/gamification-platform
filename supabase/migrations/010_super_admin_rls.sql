-- Migration 010: Super Admin read-access RLS on all existing tables
-- Grants super_admins SELECT access to all rows across the platform.
-- Uses is_super_admin() (SECURITY DEFINER) to avoid infinite recursion on user_profiles.

CREATE POLICY "Super admins can view all events"
  ON events FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can view all groups"
  ON groups FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can view all participants"
  ON participants FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can view all participant_groups"
  ON participant_groups FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can view all actions"
  ON actions FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can view all point_transactions"
  ON point_transactions FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can view all rewards"
  ON rewards FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can view all reward_groups"
  ON reward_groups FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can view all participant_rewards"
  ON participant_rewards FOR SELECT
  USING (public.is_super_admin());

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'action_groups') THEN
    EXECUTE $p$
      CREATE POLICY "Super admins can view all action_groups"
        ON action_groups FOR SELECT
        USING (public.is_super_admin())
    $p$;
  END IF;
END $$;
