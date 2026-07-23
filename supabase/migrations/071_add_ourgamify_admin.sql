-- Migration 071: Grant super_admin to ourgamify@gmail.com
-- Adds the company account to the admin allowlist established in
-- 009_user_profiles.sql, and promotes it now if it has already signed up.
-- Run in the Supabase SQL Editor.

-- ============================================================
-- 1. Keep the allowlist in the sign-up trigger in sync, so a future
--    (re)creation of this account also lands as super_admin.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      NULL
    ),
    CASE
      WHEN LOWER(COALESCE(NEW.email, '')) IN (
        'zipi3637@gmail.com',
        'chaya7908@gmail.com',
        'ourgamify@gmail.com'
      )
        THEN 'super_admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Promote the account if it already exists. Upserts from auth.users so it
--    works whether the profile row is present (update) or missing (insert).
--    No-op if the account has not signed up yet - the trigger above covers it.
-- ============================================================
INSERT INTO public.user_profiles (id, email, display_name, role)
SELECT
  id,
  COALESCE(email, ''),
  COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    ''
  ),
  'super_admin'
FROM auth.users
WHERE LOWER(email) = 'ourgamify@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
