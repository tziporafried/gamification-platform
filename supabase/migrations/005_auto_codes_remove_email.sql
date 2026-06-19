-- Phase 4: Auto-generate participant/action codes, remove participant email
-- Run after 004_create_leaderboard_functions.sql in Supabase SQL Editor

-- ============================================================
-- 1. DROP EMAIL COLUMN FROM PARTICIPANTS
-- ============================================================
ALTER TABLE participants DROP COLUMN IF EXISTS email;

-- ============================================================
-- 2. AUTO-GENERATE PARTICIPANT CODE (external_id)
-- Format: P-1001, P-1002, ...
-- Existing non-matching codes are preserved; numbering starts
-- from max existing P-XXXX number or 1000 if none exist.
-- ============================================================
CREATE OR REPLACE FUNCTION generate_participant_code()
RETURNS TRIGGER AS $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN external_id ~ '^P-[0-9]+$'
      THEN CAST(SUBSTRING(external_id FROM 3) AS INTEGER)
      ELSE 0
    END
  ), 1000) INTO max_num
  FROM participants
  WHERE event_id = NEW.event_id;

  NEW.external_id := 'P-' || (max_num + 1)::TEXT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER participants_auto_code
  BEFORE INSERT ON participants
  FOR EACH ROW
  EXECUTE FUNCTION generate_participant_code();

-- ============================================================
-- 3. AUTO-GENERATE ACTION CODE
-- Format: A-1001, A-1002, ...
-- Existing non-matching codes are preserved; numbering starts
-- from max existing A-XXXX number or 1000 if none exist.
-- ============================================================
CREATE OR REPLACE FUNCTION generate_action_code()
RETURNS TRIGGER AS $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN code ~ '^A-[0-9]+$'
      THEN CAST(SUBSTRING(code FROM 3) AS INTEGER)
      ELSE 0
    END
  ), 1000) INTO max_num
  FROM actions
  WHERE event_id = NEW.event_id;

  NEW.code := 'A-' || (max_num + 1)::TEXT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER actions_auto_code
  BEFORE INSERT ON actions
  FOR EACH ROW
  EXECUTE FUNCTION generate_action_code();
