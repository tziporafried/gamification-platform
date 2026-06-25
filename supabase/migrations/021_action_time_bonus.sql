-- Phase 21: Time-Based Challenges & Speed Bonus
-- Adds optional time limitation and speed bonus to actions

ALTER TABLE actions
  ADD COLUMN time_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN start_at TIMESTAMPTZ,
  ADD COLUMN end_at TIMESTAMPTZ,
  ADD COLUMN duration_minutes INTEGER,
  ADD COLUMN speed_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN speed_bonus_minutes INTEGER,
  ADD COLUMN speed_multiplier NUMERIC NOT NULL DEFAULT 2;

CREATE INDEX idx_actions_time_enabled ON actions(event_id, time_enabled) WHERE time_enabled = true;

-- Validation: when time is enabled, start_at and either end_at or duration_minutes must be set
CREATE OR REPLACE FUNCTION validate_action_time_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.time_enabled THEN
    IF NEW.start_at IS NULL THEN
      RAISE EXCEPTION 'start_at is required when time limitation is enabled';
    END IF;

    IF NEW.end_at IS NULL AND NEW.duration_minutes IS NULL THEN
      RAISE EXCEPTION 'Either end_at or duration_minutes is required when time limitation is enabled';
    END IF;

    IF NEW.duration_minutes IS NOT NULL AND NEW.duration_minutes <= 0 THEN
      RAISE EXCEPTION 'duration_minutes must be positive';
    END IF;

    -- Auto-calculate end_at from start_at + duration_minutes if not set
    IF NEW.end_at IS NULL AND NEW.duration_minutes IS NOT NULL THEN
      NEW.end_at := NEW.start_at + (NEW.duration_minutes || ' minutes')::INTERVAL;
    END IF;

    IF NEW.end_at <= NEW.start_at THEN
      RAISE EXCEPTION 'end_at must be after start_at';
    END IF;
  END IF;

  IF NEW.speed_bonus_enabled THEN
    IF NOT NEW.time_enabled THEN
      RAISE EXCEPTION 'Time limitation must be enabled for speed bonus';
    END IF;

    IF NEW.speed_bonus_minutes IS NULL THEN
      RAISE EXCEPTION 'speed_bonus_minutes is required when speed bonus is enabled';
    END IF;

    IF NEW.speed_bonus_minutes <= 0 THEN
      RAISE EXCEPTION 'speed_bonus_minutes must be positive';
    END IF;

    IF NEW.speed_multiplier <= 1 THEN
      RAISE EXCEPTION 'speed_multiplier must be greater than 1';
    END IF;

    -- Validate that bonus window ends before action ends
    IF NEW.start_at + (NEW.speed_bonus_minutes || ' minutes')::INTERVAL > NEW.end_at THEN
      RAISE EXCEPTION 'Speed bonus window must end before the action ends';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_action_time_before_save
  BEFORE INSERT OR UPDATE ON actions
  FOR EACH ROW
  EXECUTE FUNCTION validate_action_time_config();
