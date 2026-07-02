-- Align group color DB defaults with the approved product palette
ALTER TABLE groups ALTER COLUMN color SET DEFAULT '#AB3500';

ALTER TABLE activity_template_groups ALTER COLUMN color SET DEFAULT '#AB3500';
