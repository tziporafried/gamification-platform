-- Phase 22: Flat point bonus option for speed bonus
-- Adds speed_bonus_flat_points column; when set, awards flat extra points instead of a multiplier

ALTER TABLE actions ADD COLUMN speed_bonus_flat_points INTEGER;

-- Replace trigger to support both multiplier and flat bonus modes.
-- Flat mode:       speed_bonus_flat_points IS NOT NULL  (speed_multiplier is ignored)
-- Multiplier mode: speed_bonus_flat_points IS NULL       (speed_multiplier must be > 1)
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

    -- Validate bonus amount: flat mode OR multiplier mode, not both
    IF NEW.speed_bonus_flat_points IS NOT NULL THEN
      IF NEW.speed_bonus_flat_points <= 0 THEN
        RAISE EXCEPTION 'speed_bonus_flat_points must be positive';
      END IF;
    ELSE
      IF NEW.speed_multiplier <= 1 THEN
        RAISE EXCEPTION 'speed_multiplier must be greater than 1';
      END IF;
    END IF;

    IF NEW.start_at + (NEW.speed_bonus_minutes || ' minutes')::INTERVAL > NEW.end_at THEN
      RAISE EXCEPTION 'Speed bonus window must end before the action ends';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
