-- Phase 30: Link activity templates to draft events for wizard-based editing

ALTER TABLE activity_templates
  ADD COLUMN draft_event_id UUID REFERENCES events(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_activity_templates_draft_event
  ON activity_templates(draft_event_id)
  WHERE draft_event_id IS NOT NULL;
