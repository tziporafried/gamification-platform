-- Migration 013: Add missing DELETE RLS policy on actions table
-- The owner admin had SELECT, INSERT, UPDATE but was missing DELETE.

CREATE POLICY "Admins can delete own event actions"
  ON actions FOR DELETE
  USING (event_id IN (SELECT id FROM events WHERE owner_admin_id = auth.uid()));
