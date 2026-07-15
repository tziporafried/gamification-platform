-- Migration 059: Shared display names for short utm_content link codes
-- Super admins map cryptic codes (rs, f01) to human-readable labels.

CREATE TABLE utm_link_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT utm_link_labels_code_not_blank CHECK (length(trim(content_code)) > 0),
  CONSTRAINT utm_link_labels_name_not_blank CHECK (length(trim(display_name)) > 0)
);

CREATE TRIGGER utm_link_labels_updated_at
  BEFORE UPDATE ON utm_link_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE utm_link_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage utm link labels"
  ON utm_link_labels FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
