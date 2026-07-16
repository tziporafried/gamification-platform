-- Migration 062: pin search_path on SECURITY DEFINER functions.
--
-- A SECURITY DEFINER function runs with its owner's privileges. With a mutable
-- search_path, it resolves unqualified names using the *caller's* search_path,
-- so anyone who can create objects in an earlier schema can shadow a table or
-- operator the function relies on and have it run their code as the owner.
--
-- This matters here because public.is_super_admin() is the linchpin of every
-- super-admin RLS policy, and update_user_plan / delete_user_admin /
-- check_plan_limit are privileged.
--
-- Pinning to `public, pg_temp` is safe for this schema:
--   * every auth reference in these functions is already schema-qualified
--     (auth.uid(), auth.users, auth.identities, auth.role)
--   * gen_random_uuid() lives in pg_catalog, which is always searched first
--     and cannot be shadowed
--   * unqualified table names in these functions all live in public, which
--     stays in the path
-- pg_temp is listed last so a caller's temp schema can never take precedence.
--
-- This is Supabase's `function_search_path_mutable` linter rule.
--
-- Written as a loop over pg_proc rather than explicit ALTER statements so it
-- cannot fail on a signature mismatch, only touches functions that are actually
-- SECURITY DEFINER and not already pinned, and stays idempotent.

DO $$
DECLARE
  fn RECORD;
  pinned INT := 0;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.signature);
    pinned := pinned + 1;
  END LOOP;

  RAISE NOTICE 'Pinned search_path on % SECURITY DEFINER function(s)', pinned;
END $$;
