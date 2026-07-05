-- Migration 045: Daily completion limit per participant
-- daily_limit = once per calendar day; optional time window on the same day

ALTER TABLE actions
  ADD COLUMN daily_limit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN daily_start_hour INTEGER DEFAULT NULL,
  ADD COLUMN daily_start_minute INTEGER DEFAULT NULL,
  ADD COLUMN daily_end_hour INTEGER DEFAULT NULL,
  ADD COLUMN daily_end_minute INTEGER DEFAULT NULL;

ALTER TABLE actions
  ADD CONSTRAINT actions_daily_time_window
  CHECK (
    (
      daily_start_hour IS NULL
      AND daily_start_minute IS NULL
      AND daily_end_hour IS NULL
      AND daily_end_minute IS NULL
    )
    OR (
      daily_start_hour IS NOT NULL
      AND daily_start_minute IS NOT NULL
      AND daily_end_hour IS NOT NULL
      AND daily_end_minute IS NOT NULL
      AND daily_start_hour >= 0
      AND daily_start_hour <= 23
      AND daily_start_minute >= 0
      AND daily_start_minute <= 59
      AND daily_end_hour >= 0
      AND daily_end_hour <= 23
      AND daily_end_minute >= 0
      AND daily_end_minute <= 59
      AND (daily_start_hour * 60 + daily_start_minute) < (daily_end_hour * 60 + daily_end_minute)
    )
  );
