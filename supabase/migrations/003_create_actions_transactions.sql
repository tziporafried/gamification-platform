-- Phase 3: Actions & Point Transactions
-- Run after 002_create_groups_participants.sql in Supabase SQL Editor

-- ============================================================
-- ACTIONS (scoring rules)
-- ============================================================
CREATE TABLE actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_actions_event_code ON actions(event_id, code);
CREATE INDEX idx_actions_event_id ON actions(event_id);

CREATE TRIGGER actions_updated_at
  BEFORE UPDATE ON actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- POINT_TRANSACTIONS (immutable scoring log)
-- ============================================================
CREATE TABLE point_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  action_id UUID REFERENCES actions(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_point_transactions_event_created ON point_transactions(event_id, created_at DESC);

-- Immutability: prevent updates
CREATE OR REPLACE FUNCTION prevent_point_transaction_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Point transactions cannot be modified';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER point_transactions_no_update
  BEFORE UPDATE ON point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_point_transaction_update();

-- Immutability: prevent deletes
CREATE OR REPLACE FUNCTION prevent_point_transaction_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Point transactions cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER point_transactions_no_delete
  BEFORE DELETE ON point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_point_transaction_delete();

-- Same-event guard: participant and action must belong to the transaction's event
CREATE OR REPLACE FUNCTION check_transaction_same_event()
RETURNS TRIGGER AS $$
DECLARE
  p_event_id UUID;
  a_event_id UUID;
BEGIN
  SELECT event_id INTO p_event_id FROM participants WHERE id = NEW.participant_id;
  SELECT event_id INTO a_event_id FROM actions WHERE id = NEW.action_id;

  IF p_event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'Participant does not belong to this event';
  END IF;

  IF a_event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'Action does not belong to this event';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER point_transactions_same_event
  BEFORE INSERT ON point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_transaction_same_event();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- ACTIONS
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own event actions"
  ON actions FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can create actions for own event"
  ON actions FOR INSERT
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can update own event actions"
  ON actions FOR UPDATE
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

-- POINT_TRANSACTIONS
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own event transactions"
  ON point_transactions FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can create transactions for own event"
  ON point_transactions FOR INSERT
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));
