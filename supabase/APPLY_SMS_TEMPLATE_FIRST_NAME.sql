-- Apply on remote if migrations are not auto-run:
--   Supabase SQL editor - paste this file, run once.
-- Idempotent: both statements are no-ops on a second run - the first matches no
-- {{שם}} left to rename, the second no template left equal to the default.
--
-- Source: migrations/084_sms_template_first_name.sql
-- Needed by: the saved SMS wording. Without this, every game that walked past
-- the wizard's SMS step before the name was split keeps greeting participants
-- by their whole name - "היי דנה כהן!" - because it holds a verbatim copy of
-- the old default rather than the NULL that would let the new one apply.
--
-- Run after 083. Safe on a live event: it renames one variable inside whatever
-- sentence the customer wrote and changes nothing else about the message.

-- Migration 084: the saved messages still greet people by their whole name.
--
-- 083 split a participant's name in two, and the SMS step swapped its single
-- {{שם}} variable for {{שם פרטי}} and {{שם משפחה}}. A greeting is the given
-- name - "היי דנה" - which is what the step's own preview has always shown.
--
-- Changing DEFAULT_SMS_TEMPLATE was not enough to deliver that, because the
-- default only applies to a game whose `sms_template` is NULL, and almost none
-- are. The wizard step wrote the text it was showing whenever the operator
-- advanced, including when they had changed nothing, so every game that walked
-- past that step has the old default stored verbatim with {{שם}} inside it.
-- (The step no longer does this - see StepSmsSettings.handleNext.)
--
-- Two things happen here.

-- ============================================================
-- 1. {{שם}} becomes {{שם פרטי}}, wherever it was written
-- ============================================================
-- A rename of the variable, not a rewrite of the message: whatever sentence the
-- customer built around it is left exactly as they wrote it, and only which
-- half of the name fills in changes. Nobody chose the whole name over the
-- given name - until 083 there was nothing to choose between.
--
-- The English aliases go too, for the same reason and with the same effect.
-- {{שם פרטי}} and {{שם משפחה}} cannot match: after `שם` those have a word
-- rather than the closing braces, so the pattern below fails on them.
--
-- {{שם}} still resolves in the app either way. This is about what the message
-- says, not about keeping old templates working.

UPDATE events
SET sms_template = regexp_replace(
      sms_template,
      '\{\{\s*(שם|name|participant)\s*\}\}',
      '{{שם פרטי}}',
      'g'
    )
WHERE sms_template ~ '\{\{\s*(שם|name|participant)\s*\}\}';

-- ============================================================
-- 2. A message nobody edited goes back to meaning "not edited"
-- ============================================================
-- After the rename, a game that never touched the wording holds a copy of the
-- default rather than the NULL that says so. Putting the NULL back is what lets
-- the next change to DEFAULT_SMS_TEMPLATE reach these games at all - the exact
-- thing that failed here.
--
-- Compared against the default *after* the rename, so this catches the games
-- step 1 just rewrote as well as any that were already current. A customer who
-- deliberately typed the default word for word gets the same treatment, which
-- is the documented meaning of the column rather than a loss: what they typed
-- is what they keep receiving.

UPDATE events
SET sms_template = NULL
WHERE sms_template IS NOT NULL
  AND btrim(sms_template) = 'היי {{שם פרטי}}! קיבלת {{ניקוד}} נק'' על "{{משימה}}". סה"כ יש לך {{סהכ}} נק''.';
