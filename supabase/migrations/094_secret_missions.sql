-- Migration 094: a task can be one participant's secret mission.
--
-- "Get everyone to say 'ישתבח שמו'" - a task one participant is given in
-- private, that nobody else in the room is supposed to know about until it is
-- done. The scan screen advertises it only as "המשימה הסודית של X", and names
-- the task itself once X's card has been scanned for it.
--
--   is_secret               the checkbox. Stays true even if the participant it
--                           names is deleted, so the task's name never falls
--                           back onto the scan screen by accident.
--   secret_participant_id   the only participant who may score it. NULL while
--                           the organiser has ticked the box but not picked
--                           anyone yet - then nobody can score it, and the scan
--                           screen does not advertise it.
--
-- Nothing here creates the `secret_missions` feature flag - that row is made by
-- hand in the admin panel, like every other flag.

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS is_secret BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS secret_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_actions_secret_participant
  ON actions(secret_participant_id) WHERE secret_participant_id IS NOT NULL;

COMMENT ON COLUMN actions.is_secret IS
  'A secret mission: the scan screen hides its name until it is scanned. Only secret_participant_id may score it.';
COMMENT ON COLUMN actions.secret_participant_id IS
  'The participant a secret mission belongs to. NULL = not assigned yet, so nobody can score it.';

-- The participant must be from the task's own game. RLS already keeps an owner
-- inside their own games, but not from naming one game's player on another
-- game's task.
CREATE OR REPLACE FUNCTION public.check_action_secret_participant_same_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  p_event_id UUID;
BEGIN
  IF NEW.secret_participant_id IS NOT NULL THEN
    SELECT event_id INTO p_event_id FROM participants WHERE id = NEW.secret_participant_id;
    IF p_event_id IS DISTINCT FROM NEW.event_id THEN
      RAISE EXCEPTION 'Secret mission participant does not belong to this event';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS actions_secret_participant_same_event ON actions;
CREATE TRIGGER actions_secret_participant_same_event
  BEFORE INSERT OR UPDATE OF secret_participant_id, event_id ON actions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_action_secret_participant_same_event();
