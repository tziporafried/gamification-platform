-- Simplify event_status enum: draft/active/finished/archived → editing/active
-- Migration strategy:
--   draft    → editing
--   active   → active (no change)
--   finished → editing
--   archived → editing

-- PostgreSQL doesn't allow using a new enum value in the same transaction
-- where it was added. Recreate the type instead.

-- Step 1: Remove the default so we can alter the column type
ALTER TABLE events ALTER COLUMN status DROP DEFAULT;

-- Step 2: Convert column to text
ALTER TABLE events ALTER COLUMN status TYPE text;

-- Step 3: Migrate values
UPDATE events SET status = 'editing' WHERE status IN ('draft', 'finished', 'archived');

-- Step 4: Drop and recreate the enum
DROP TYPE event_status;
CREATE TYPE event_status AS ENUM ('editing', 'active');

-- Step 5: Convert column back to enum
ALTER TABLE events ALTER COLUMN status TYPE event_status USING status::event_status;

-- Step 6: Set default
ALTER TABLE events ALTER COLUMN status SET DEFAULT 'editing';
