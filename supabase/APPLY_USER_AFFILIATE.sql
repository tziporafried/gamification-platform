-- Apply manually in Supabase SQL editor if migrations are applied outside CLI.
-- Same content as migrations/060_user_affiliate_attribution.sql

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS affiliate_attribution JSONB;

COMMENT ON COLUMN public.user_profiles.affiliate_attribution IS
  'First-touch UTM attribution (utm_source/medium/campaign/content). Set once on auth when present.';

CREATE OR REPLACE FUNCTION public.claim_affiliate_attribution(p_attribution JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean JSONB := '{}'::jsonb;
  v_key TEXT;
  v_val TEXT;
  v_updated INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_attribution IS NULL OR jsonb_typeof(p_attribution) <> 'object' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'empty');
  END IF;

  FOREACH v_key IN ARRAY ARRAY['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
  LOOP
    v_val := NULLIF(LEFT(TRIM(COALESCE(p_attribution ->> v_key, '')), 100), '');
    IF v_val IS NULL THEN
      CONTINUE;
    END IF;
    IF v_val ~ '@' OR v_val ~ '^\+?\d{7,}$' THEN
      CONTINUE;
    END IF;
    v_clean := v_clean || jsonb_build_object(v_key, v_val);
  END LOOP;

  IF v_clean = '{}'::jsonb THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'empty');
  END IF;

  UPDATE public.user_profiles
  SET affiliate_attribution = v_clean
  WHERE id = v_uid
    AND affiliate_attribution IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RETURN jsonb_build_object('claimed', true, 'attribution', v_clean);
  END IF;

  RETURN jsonb_build_object('claimed', false, 'reason', 'already_set');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_affiliate_attribution(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_affiliate_attribution(JSONB) TO authenticated;

-- Also seed first-touch from auth metadata when the profile row is created (email sign-up).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_attr JSONB := NULL;
  v_clean JSONB := '{}'::jsonb;
  v_key TEXT;
  v_val TEXT;
BEGIN
  IF NEW.raw_user_meta_data ? 'affiliate_attribution'
     AND jsonb_typeof(NEW.raw_user_meta_data -> 'affiliate_attribution') = 'object'
  THEN
    v_attr := NEW.raw_user_meta_data -> 'affiliate_attribution';
    FOREACH v_key IN ARRAY ARRAY['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
    LOOP
      v_val := NULLIF(LEFT(TRIM(COALESCE(v_attr ->> v_key, '')), 100), '');
      IF v_val IS NULL OR v_val ~ '@' OR v_val ~ '^\+?\d{7,}$' THEN
        CONTINUE;
      END IF;
      v_clean := v_clean || jsonb_build_object(v_key, v_val);
    END LOOP;
    IF v_clean = '{}'::jsonb THEN
      v_clean := NULL;
    END IF;
  END IF;

  INSERT INTO public.user_profiles (id, email, display_name, avatar_url, role, affiliate_attribution)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      NULL
    ),
    CASE
      WHEN LOWER(COALESCE(NEW.email, '')) IN ('zipi3637@gmail.com', 'chaya7908@gmail.com')
        THEN 'super_admin'
      ELSE 'user'
    END,
    v_clean
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS get_all_users_admin();
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE (
  user_id                 UUID,
  email                   TEXT,
  display_name            TEXT,
  avatar_url              TEXT,
  role                    TEXT,
  created_at              TIMESTAMPTZ,
  last_sign_in_at         TIMESTAMPTZ,
  event_count             BIGINT,
  event_names             TEXT,
  affiliate_attribution   JSONB
) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles up2
    WHERE up2.id = auth.uid() AND up2.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  RETURN QUERY
  SELECT
    up.id          AS user_id,
    up.email,
    up.display_name,
    up.avatar_url,
    up.role,
    up.created_at,
    au.last_sign_in_at,
    COALESCE(ev.cnt, 0)    AS event_count,
    COALESCE(ev.names, '') AS event_names,
    up.affiliate_attribution
  FROM user_profiles up
  LEFT JOIN auth.users au ON au.id = up.id
  LEFT JOIN (
    SELECT
      owner_admin_id,
      COUNT(*)::BIGINT AS cnt,
      STRING_AGG(e.name, ', ' ORDER BY e.created_at DESC)
        FILTER (WHERE e.name IS NOT NULL AND TRIM(e.name) != '') AS names
    FROM events e
    WHERE e.status != 'archived'
    GROUP BY owner_admin_id
  ) ev ON ev.owner_admin_id = up.id
  ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
