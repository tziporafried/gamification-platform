-- Demo user events always get the full plan (no free-tier caps during demos).
-- Demo account: demo@test.local (see migration 041_demo_user.sql)

CREATE OR REPLACE FUNCTION set_demo_event_full_plan()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_admin_id = '00000000-0000-0000-0000-000000000099'::uuid
     OR EXISTS (
       SELECT 1 FROM user_profiles
       WHERE id = NEW.owner_admin_id AND email = 'demo@test.local'
     )
  THEN
    NEW.plan := 'full';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_demo_event_full_plan ON events;

CREATE TRIGGER trg_demo_event_full_plan
  BEFORE INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION set_demo_event_full_plan();

-- Backfill any existing demo events
UPDATE events
SET plan = 'full', updated_at = now()
WHERE owner_admin_id = '00000000-0000-0000-0000-000000000099'::uuid
   OR owner_admin_id IN (
     SELECT id FROM user_profiles WHERE email = 'demo@test.local'
   );
