-- Migration 036: Normalize event plans
-- Super admin events → 'full', all customer events → 'free'
-- Wrapped in DO block so it's a no-op if events.plan column doesn't exist yet

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'plan'
  ) THEN
    -- Customer events: always free
    UPDATE events
    SET plan = 'free'
    WHERE owner_admin_id IN (
      SELECT id FROM user_profiles WHERE role != 'super_admin'
    );

    -- Super admin events: full plan (enables QR scan + no limits)
    UPDATE events
    SET plan = 'full'
    WHERE owner_admin_id IN (
      SELECT id FROM user_profiles WHERE role = 'super_admin'
    );
  END IF;
END $$;
