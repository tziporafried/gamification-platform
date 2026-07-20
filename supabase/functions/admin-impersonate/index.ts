// Edge Function: admin-impersonate
// Lets a super_admin obtain a one-time magic-link token_hash for a regular user,
// so the admin UI can switch into that user's real Supabase session (RLS and all).
//
// Body: { userId: string }
// Returns: { token_hash: string, email: string, display_name: string | null }
//
// Auth: valid JWT + user_profiles.role === 'super_admin'.
// Automatically provided by Supabase:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: callerError,
    } = await userClient.auth.getUser()

    if (callerError || !caller) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()

    if (callerProfileError || callerProfile?.role !== 'super_admin') {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const { userId } = await req.json().catch(() => ({ userId: null }))
    if (!userId || typeof userId !== 'string') {
      return jsonResponse({ error: 'Missing userId' }, 400)
    }

    if (userId === caller.id) {
      return jsonResponse({ error: 'Cannot impersonate yourself' }, 400)
    }

    const { data: target, error: targetError } = await adminClient
      .from('user_profiles')
      .select('id, email, display_name, role')
      .eq('id', userId)
      .maybeSingle()

    if (targetError || !target) {
      return jsonResponse({ error: 'User not found' }, 404)
    }

    if (target.role === 'super_admin') {
      return jsonResponse({ error: 'Cannot impersonate a super admin' }, 403)
    }

    if (!target.email) {
      return jsonResponse({ error: 'User has no email' }, 400)
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: target.email,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('generateLink failed', linkError)
      return jsonResponse({ error: 'Failed to generate login token' }, 500)
    }

    console.log(
      JSON.stringify({
        event: 'admin_impersonate',
        admin_id: caller.id,
        target_user_id: target.id,
        at: new Date().toISOString(),
      }),
    )

    return jsonResponse({
      token_hash: linkData.properties.hashed_token,
      email: target.email,
      display_name: target.display_name,
    })
  } catch (err) {
    console.error('Unexpected error', err)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
