-- Allow multiple events per admin (removes one-event-per-admin restriction)
DROP INDEX IF EXISTS idx_events_owner;
