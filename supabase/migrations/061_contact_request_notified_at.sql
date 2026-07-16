-- Migration 061: one-notification-per-request guard.
--
-- notify-contact-request runs with verify_jwt = false so anonymous pricing-page
-- visitors can trigger it. It had no replay guard: anyone could POST the same
-- requestId in a loop and send an admin email every time, with no auth and no
-- rate limit. That traffic goes straight to Supabase, so the Vercel edge
-- middleware never sees it.
--
-- This column lets the function atomically claim a request before sending, so a
-- given request produces at most one notification no matter how often the
-- endpoint is called.

ALTER TABLE public.contact_upgrade_requests
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Existing rows have already been notified; backfill so historical ids cannot be
-- replayed to generate fresh emails.
UPDATE public.contact_upgrade_requests
  SET notified_at = created_at
  WHERE notified_at IS NULL;

-- Supports the claim query's WHERE id = ? AND notified_at IS NULL.
CREATE INDEX IF NOT EXISTS idx_contact_upgrade_requests_notified_at
  ON public.contact_upgrade_requests(notified_at)
  WHERE notified_at IS NULL;

-- No RLS policy grants anon SELECT or UPDATE on this table, so the column is
-- only reachable by the service-role function and by super admins.
