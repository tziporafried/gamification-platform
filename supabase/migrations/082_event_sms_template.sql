-- Migration 082: the text a game sends after a scan, in its owner's words.
--
-- Games with the `sms_notifications` flag text every participant who has a
-- phone number (081) whenever they scan: what they just scored, on which task,
-- and their new total. A school, a company retreat and a bar mitzvah do not
-- address people the same way, and the message arrives from the customer's own
-- game - so the sentence is theirs to write, on a wizard step that only games
-- with the flag ever see.
--
-- NULL means nobody changed it, which is the ordinary state and not an
-- unfinished one: the client falls back to DEFAULT_SMS_TEMPLATE, a complete
-- message that already says the right things. Existing games are left NULL for
-- the same reason - there is nothing to backfill, only a default to inherit.
--
-- The template is filled in at send time by src/lib/smsTemplate.ts. Variables
-- are written `{{שם}}`, `{{משימה}}`, `{{ניקוד}}`, `{{סהכ}}`, `{{פעילות}}`;
-- anything else is left standing in the message rather than erased, so a typo
-- is visible instead of silently sending a sentence with a hole in it. No CHECK
-- enforces any of that: which variables exist is a product question that will
-- change without a migration, and a constraint here would only turn a new
-- variable into a deploy that has to be ordered.
--
-- The length limit is a cost limit, not a format one. Hebrew SMS is billed per
-- 70 characters, per participant, per scan - a game with 300 participants
-- scanning ten stations pays for this column 3,000 times over. 480 characters
-- caps one message at roughly seven segments; the wizard says the same thing in
-- Hebrew before it ever gets here.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS sms_template TEXT
  CHECK (sms_template IS NULL OR char_length(sms_template) <= 480);

COMMENT ON COLUMN events.sms_template IS
  'Per-scan SMS text with {{variables}}, for games with the sms_notifications feature flag. NULL = the built-in default.';

-- No new policy: the owner's own UPDATE policy (001) already covers this
-- column, and the wizard is the only thing that writes it.
