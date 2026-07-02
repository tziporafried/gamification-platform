-- Demo user for ?demo=true login flow — do NOT use in production
-- Credentials: demo@test.local / demo-password-123

DO $$
DECLARE
  v_user_id  UUID := '00000000-0000-0000-0000-000000000099';
  v_email    TEXT := 'demo@test.local';
  v_password TEXT := 'demo-password-123';
BEGIN
  -- Skip if already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RETURN;
  END IF;

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Demo User"}',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- Required for email/password login — without this GoTrue returns "Database error querying schema"
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_email,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    now(),
    now(),
    now()
  );

  -- Ensure a profile row exists (trigger may not fire inside DO block on all Supabase versions)
  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (v_user_id, v_email, 'Demo User', 'user')
  ON CONFLICT (id) DO NOTHING;
END;
$$;
