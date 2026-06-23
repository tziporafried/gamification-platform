-- Add 'archived' to event_status enum for soft-delete support
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'archived';
