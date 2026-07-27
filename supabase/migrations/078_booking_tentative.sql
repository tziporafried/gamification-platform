-- Migration 078: bookings that are not closed yet - the question-mark hold.
--
-- Families ask to hold a date long before they commit, and until now the board
-- had no way to say so: a booking either owned a scanner or did not exist. So
-- a maybe-booking either squatted on a scanner that could have been sold, or
-- was left off the board entirely and forgotten.
--
-- A tentative booking still shows on the board and still holds its scanner,
-- but it does not block anyone: booking another game onto that scanner over
-- the same dates moves the tentative one to the scanner-less row rather than
-- failing on scanner_bookings_no_overlap. The client does that move itself,
-- before writing the new booking - the exclusion constraint below stays as
-- strict as it was, and NULL scanner_id is exempt from it (NULL = NULL is not
-- true), which is what makes the scanner-less row able to hold overlaps.

ALTER TABLE scanner_bookings
  ADD COLUMN IF NOT EXISTS is_tentative BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN scanner_bookings.is_tentative IS
  'True = a hold, not a closed booking. Another booking may take its scanner, which drops this one to scanner_id = NULL.';

-- No new policy: the existing admin policies from 058 cover every column.
