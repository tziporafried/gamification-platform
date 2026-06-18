-- Phase 2: Groups & Participants
-- Run after 001_create_events.sql in Supabase SQL Editor

-- ============================================================
-- GROUPS
-- ============================================================
CREATE TABLE groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT groups_color_hex CHECK (color ~* '^#[0-9a-f]{6}$')
);

CREATE UNIQUE INDEX idx_groups_event_name ON groups(event_id, name);
CREATE INDEX idx_groups_event_id ON groups(event_id);

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PARTICIPANTS
-- ============================================================
CREATE TABLE participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_participants_event_external_id ON participants(event_id, external_id);
CREATE INDEX idx_participants_event_id ON participants(event_id);

CREATE TRIGGER participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PARTICIPANT_GROUPS (junction)
-- ============================================================
CREATE TABLE participant_groups (
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, group_id)
);

CREATE INDEX idx_participant_groups_group_id ON participant_groups(group_id);

-- ============================================================
-- CROSS-EVENT GUARD
-- Ensures participant and group belong to the same event
-- ============================================================
CREATE OR REPLACE FUNCTION check_participant_group_same_event()
RETURNS TRIGGER AS $$
DECLARE
  p_event_id UUID;
  g_event_id UUID;
BEGIN
  SELECT event_id INTO p_event_id FROM participants WHERE id = NEW.participant_id;
  SELECT event_id INTO g_event_id FROM groups WHERE id = NEW.group_id;

  IF p_event_id IS DISTINCT FROM g_event_id THEN
    RAISE EXCEPTION 'Participant and group must belong to the same event';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER participant_groups_same_event
  BEFORE INSERT ON participant_groups
  FOR EACH ROW
  EXECUTE FUNCTION check_participant_group_same_event();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- GROUPS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own event groups"
  ON groups FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can create groups for own event"
  ON groups FOR INSERT
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can update own event groups"
  ON groups FOR UPDATE
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can delete own event groups"
  ON groups FOR DELETE
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

-- PARTICIPANTS
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own event participants"
  ON participants FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can create participants for own event"
  ON participants FOR INSERT
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can update own event participants"
  ON participants FOR UPDATE
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

CREATE POLICY "Admins can delete own event participants"
  ON participants FOR DELETE
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));

-- PARTICIPANT_GROUPS
ALTER TABLE participant_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own event assignments"
  ON participant_groups FOR SELECT
  USING (
    participant_id IN (
      SELECT id FROM participants
      WHERE event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid())
    )
  );

CREATE POLICY "Admins can create assignments for own event"
  ON participant_groups FOR INSERT
  WITH CHECK (
    participant_id IN (
      SELECT id FROM participants
      WHERE event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid())
    )
  );

CREATE POLICY "Admins can delete own event assignments"
  ON participant_groups FOR DELETE
  USING (
    participant_id IN (
      SELECT id FROM participants
      WHERE event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid())
    )
  );
