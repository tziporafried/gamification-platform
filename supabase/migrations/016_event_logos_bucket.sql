-- Storage bucket for event logos
INSERT INTO storage.buckets (id, name, public)
  VALUES ('event-logos', 'event-logos', true)
  ON CONFLICT (id) DO NOTHING;

-- Drop old policies if they were created manually from migration 001 comments
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own logos" ON storage.objects;
DROP POLICY IF EXISTS "Public logo access" ON storage.objects;

-- Helper: check if the current user can manage a given event (owner OR collaborator)
CREATE OR REPLACE FUNCTION public.can_manage_event_logo(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = (split_part(object_name, '/', 1))::UUID
      AND owner_admin_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.event_collaborators
    WHERE event_id = (split_part(object_name, '/', 1))::UUID
      AND user_id = auth.uid()
  )
$$;

-- Any owner or collaborator can upload a logo for their event
CREATE POLICY "Event members can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-logos' AND public.can_manage_event_logo(name));

-- Any owner or collaborator can replace the logo
CREATE POLICY "Event members can update logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'event-logos' AND public.can_manage_event_logo(name));

-- Any owner or collaborator can delete the logo
CREATE POLICY "Event members can delete logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-logos' AND public.can_manage_event_logo(name));

-- Public read access for logos
CREATE POLICY "Public logo access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-logos');

-- Allow collaborators to update event branding (logo_url, theme_color, name)
CREATE POLICY "Collaborators can update shared events"
  ON events FOR UPDATE
  USING (id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()))
  WITH CHECK (id IN (SELECT event_id FROM event_collaborators WHERE user_id = auth.uid()));
