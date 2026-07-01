-- Migration 036: Remove plan from user_profiles (cleanup after 035 + frontend migration)
-- Run this only after verifying the frontend no longer reads profile.plan or isFreePlan.

-- Drop old admin RPC that updated user-level plans
DROP FUNCTION IF EXISTS update_user_plan(UUID, TEXT);

-- Remove plan column from user_profiles
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_plan_check;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS plan;
