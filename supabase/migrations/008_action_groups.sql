-- Allow tasks (actions) to be restricted to specific groups
-- If no rows exist for an action, it's available to all groups

CREATE TABLE IF NOT EXISTS action_groups (
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (action_id, group_id)
);

-- RLS
ALTER TABLE action_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view action_groups for their events"
  ON action_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM actions a
      JOIN events e ON e.id = a.event_id
      WHERE a.id = action_groups.action_id
      AND e.owner_admin_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage action_groups for their events"
  ON action_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM actions a
      JOIN events e ON e.id = a.event_id
      WHERE a.id = action_groups.action_id
      AND e.owner_admin_id = auth.uid()
    )
  );
