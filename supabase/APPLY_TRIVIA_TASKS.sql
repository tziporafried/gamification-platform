-- Apply on remote if migrations are not auto-run:
--   Supabase SQL editor - paste this file, run once.
-- Idempotent: IF NOT EXISTS + CREATE OR REPLACE throughout, safe to re-run.
--
-- Source: migrations/088_trivia_tasks.sql
-- Needed by: trivia questions - a task that prints three answer cards, only
-- one of which scores. Until this runs the feature has nowhere to live: the
-- composer cannot save a question, and there is no answer for a scan to
-- resolve. Nothing else in the app changes either way - every existing task
-- is kind = 'standard' before this file and after it.
--
-- Safe on a live event. Adds two tables and three nullable/defaulted columns;
-- no existing row is rewritten, and no existing query is affected.
--
-- Does NOT create the `trivia_tasks` feature flag - that row is made by hand
-- in the admin panel, like every other flag.

-- Migration 088: a task can be a trivia question with three answer cards.
--
-- Every task in the app has been one card: scan it, score it. A trivia question
-- is the first task a participant can get *wrong* - it prints three cards, one
-- per answer, and only one of them is worth anything.
--
-- The shape that makes this work is one task, not three:
--
--   actions            one row, kind = 'trivia'. The question, its points, its
--                      groups, its limit - everything a task already has.
--   action_options     three rows. The answers, one of them correct, each with
--                      a code of its own because each is printed on its own card.
--
-- Three separate `actions` rows would have been less code - printing, scanning
-- and the offline pack would need no changes at all - and it is the wrong
-- answer. A task's limit is what makes "one attempt" real, and a limit on one
-- row knows nothing about its two siblings: a participant would scan all three
-- cards and collect the points from whichever was right. The same split also
-- inflates the task count the plan limits are measured against, and puts two
-- decoys in every list in the app that names the game's tasks.
--
-- So the decoys are not tasks. They are answers, and the scan resolves them
-- back to the one task they belong to.
--
-- ── What scores ──────────────────────────────────────────────────────────────
-- The correct answer is worth `actions.points`; a wrong one is worth 0 - and is
-- still written to point_transactions. That row is the whole mechanism: it is
-- what max_completions = 1 counts, so the second and third card are refused as
-- LIMIT_REACHED. A wrong answer that left no trace would leave a participant
-- free to scan until they won, which is a quiz with no question in it.
--
-- ── What this file does NOT do ───────────────────────────────────────────────
-- Nothing here is gated on the `trivia_tasks` feature flag, and nothing here
-- creates it - flags are made by hand in the admin panel. This migration only
-- gives the app somewhere to put a question. Until the client code that reads
-- these tables ships, every existing game behaves exactly as it does today:
-- `kind` defaults to 'standard' on every row that already exists, and a task
-- with no options is the task it always was.

-- ============================================================
-- 1. WHICH KIND OF TASK
-- ============================================================
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'actions_kind_check') THEN
    ALTER TABLE actions
      ADD CONSTRAINT actions_kind_check CHECK (kind IN ('standard', 'trivia'));
  END IF;
END $$;

COMMENT ON COLUMN actions.kind IS
  'standard = one card, scan to score. trivia = a question whose answers are rows in action_options.';

-- ============================================================
-- 2. THE ANSWERS
-- ============================================================
-- `event_id` is here as well as reachable through `action_id`, for two reasons:
-- the RLS policy is then a plain column test with no join, and the scan resolves
-- "this code, in this game" in one query - which is the hot path.
CREATE TABLE IF NOT EXISTS action_options (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id  UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Filled by the trigger below from the parent task's code. Never printed in a
  -- way that says which answer it is - see the note there.
  code       TEXT NOT NULL,
  -- What the participant reads on the card.
  label      TEXT NOT NULL CHECK (length(btrim(label)) > 0),
  is_correct BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One code space per game, shared with actions: a scanned code is looked up in
-- actions first and here second, and the two can never collide (see the trigger).
CREATE UNIQUE INDEX IF NOT EXISTS idx_action_options_event_code
  ON action_options(event_id, code);

CREATE INDEX IF NOT EXISTS idx_action_options_action
  ON action_options(action_id, sort_order);

-- At most one correct answer per question, enforced rather than trusted.
--
-- "At least one" is deliberately not enforced here: a question is built one row
-- at a time and has zero correct answers for as long as it takes to insert the
-- second one. That half is the composer's job before it saves, and the
-- readiness list's job if a question ever ends up without one.
--
-- Note for whoever writes the edit flow: moving the correct answer from row A
-- to row B must clear A first, then set B. Both at once trips this index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_action_options_one_correct
  ON action_options(action_id) WHERE is_correct;

COMMENT ON TABLE action_options IS
  'The answer cards of a kind = trivia task. One row per printed card; exactly one is_correct.';

-- ============================================================
-- 3. THE ANSWER'S CODE
-- ============================================================
-- `A-1003-1`, `A-1003-2`, `A-1003-3` - the parent task's code and a number.
--
-- No collision with a task code is possible: generate_action_code() (005) only
-- ever produces `^A-[0-9]+$`, and the suffix takes these out of that shape. No
-- collision with the compact card payload either - that format splits on `*`
-- (src/lib/cardPayload.ts) and there is none here.
--
-- The number says nothing about the answer. On a code128 game the code is
-- printed as readable text under the barcode so an operator can type it in, so
-- anything systematic here - the correct answer always first, a different
-- prefix for it - would print the answer on the card. The correct answer is
-- whichever row carries is_correct, and the composer shuffles sort_order, so
-- `-1` is as likely to be wrong as right.
--
-- `event_id` is derived from the parent task rather than taken from the caller:
-- the two can then never disagree, and the client has one less field to send.
-- RLS still decides - its WITH CHECK runs on the row this trigger produces.
CREATE OR REPLACE FUNCTION public.generate_action_option_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action_code TEXT;
  v_event_id    UUID;
  v_next        INTEGER;
BEGIN
  SELECT code, event_id INTO v_action_code, v_event_id
  FROM actions WHERE id = NEW.action_id;

  IF v_action_code IS NULL THEN
    RAISE EXCEPTION 'Action % does not exist', NEW.action_id;
  END IF;

  NEW.event_id := v_event_id;

  -- A caller may supply its own code (a restore, an import). Only fill a blank.
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    SELECT COALESCE(MAX(
      CASE
        WHEN code ~ '-[0-9]+$'
        THEN CAST(regexp_replace(code, '^.*-', '') AS INTEGER)
        ELSE 0
      END
    ), 0) + 1
    INTO v_next
    FROM action_options
    WHERE action_id = NEW.action_id;

    NEW.code := v_action_code || '-' || v_next::TEXT;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS action_options_auto_code ON action_options;
CREATE TRIGGER action_options_auto_code
  BEFORE INSERT ON action_options
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_action_option_code();

-- ============================================================
-- 4. WHICH ANSWER A SCAN WAS
-- ============================================================
-- The scoring does not need this - the points are decided before the row is
-- written, and 0 is 0. The scan log does: a participant with twelve scans and
-- two hundred points is unexplainable until the log can say which of them was
-- a wrong answer, and to what.
--
-- NULL on every scan of a standard task, which is every scan taken so far.
ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS action_option_id UUID REFERENCES action_options(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_point_transactions_option
  ON point_transactions(action_option_id) WHERE action_option_id IS NOT NULL;

COMMENT ON COLUMN point_transactions.action_option_id IS
  'The answer card scanned, for a trivia task. NULL for every standard task.';

-- The same-event guard from 003, extended: an answer must belong to the task
-- the transaction names. Everything above the new block is unchanged, so this
-- replacement is safe to run on its own.
CREATE OR REPLACE FUNCTION check_transaction_same_event()
RETURNS TRIGGER AS $$
DECLARE
  p_event_id UUID;
  a_event_id UUID;
  o_action_id UUID;
BEGIN
  SELECT event_id INTO p_event_id FROM participants WHERE id = NEW.participant_id;
  SELECT event_id INTO a_event_id FROM actions WHERE id = NEW.action_id;

  IF p_event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'Participant does not belong to this event';
  END IF;

  IF a_event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'Action does not belong to this event';
  END IF;

  IF NEW.action_option_id IS NOT NULL THEN
    SELECT action_id INTO o_action_id FROM action_options WHERE id = NEW.action_option_id;
    IF o_action_id IS DISTINCT FROM NEW.action_id THEN
      RAISE EXCEPTION 'Answer does not belong to this task';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
-- The same reach the task itself has (003): the game's owner, and nobody else.
-- The scan runs under the owner's session, so this is all it needs.
ALTER TABLE action_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view own event action options" ON action_options;
CREATE POLICY "Admins can view own event action options"
  ON action_options FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can create action options for own event" ON action_options;
CREATE POLICY "Admins can create action options for own event"
  ON action_options FOR INSERT
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update own event action options" ON action_options;
CREATE POLICY "Admins can update own event action options"
  ON action_options FOR UPDATE
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can delete own event action options" ON action_options;
CREATE POLICY "Admins can delete own event action options"
  ON action_options FOR DELETE
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

-- ============================================================
-- 6. TEMPLATES
-- ============================================================
-- A template saved from a game with trivia questions has to carry the answers,
-- or the question comes back as a plain task whose name is a question nobody
-- can answer - broken, and silently so.
--
-- No `code` column: codes belong to a game and are generated fresh by the
-- trigger above every time a template is applied to one.
ALTER TABLE template_tasks
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_tasks_kind_check') THEN
    ALTER TABLE template_tasks
      ADD CONSTRAINT template_tasks_kind_check CHECK (kind IN ('standard', 'trivia'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS template_task_options (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_task_id UUID NOT NULL REFERENCES template_tasks(id) ON DELETE CASCADE,
  label            TEXT NOT NULL CHECK (length(btrim(label)) > 0),
  is_correct       BOOLEAN NOT NULL DEFAULT false,
  sort_order       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_template_task_options_task
  ON template_task_options(template_task_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_task_options_one_correct
  ON template_task_options(template_task_id) WHERE is_correct;

-- Readable by every signed-in user, writable by a super admin - the same rule
-- every other template table follows (025).
ALTER TABLE template_task_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view template task options" ON template_task_options;
CREATE POLICY "Authenticated users can view template task options"
  ON template_task_options FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super admin can manage template task options" ON template_task_options;
CREATE POLICY "Super admin can manage template task options"
  ON template_task_options FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
