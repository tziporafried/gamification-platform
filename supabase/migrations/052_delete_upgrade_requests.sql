-- Allow super admins to delete contact/upgrade requests

CREATE POLICY "Super admins can delete upgrade requests"
  ON public.contact_upgrade_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
