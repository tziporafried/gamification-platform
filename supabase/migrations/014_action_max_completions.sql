-- Migration 014: Add max_completions to actions
-- NULL = unlimited, 1 = one-time, N = limited to N completions per participant

ALTER TABLE actions ADD COLUMN max_completions INTEGER DEFAULT NULL;
