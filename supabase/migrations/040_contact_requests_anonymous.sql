-- Allow pricing-page contact requests without login

ALTER TABLE public.contact_upgrade_requests
  ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can create own upgrade requests" ON public.contact_upgrade_requests;

CREATE POLICY "Users can create own upgrade requests"
  ON public.contact_upgrade_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous users can create upgrade requests"
  ON public.contact_upgrade_requests FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);
