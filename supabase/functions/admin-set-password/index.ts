// Edge Function: admin-set-password
// Lets a super_admin set a new password for a regular user, so support can hand
// a customer who lost access a working password on the phone. The app has no
// self-service "forgot password" screen, so this is the only way back in.
//
// Body: { userId: string, password: string }
// Returns: { email: string }
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

/** Supabase's own floor; stated here so the UI and the server agree. */
const MIN_PASSWORD_LENGTH = 6

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

    const { userId, password } = await req
      .json()
      .catch(() => ({ userId: null, password: null }))

    if (!userId || typeof userId !== 'string') {
      return jsonResponse({ error: 'Missing userId' }, 400)
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return jsonResponse(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        400,
      )
    }

    const { data: target, error: targetError } = await adminClient
      .from('user_profiles')
      .select('id, email, role')
      .eq('id', userId)
      .maybeSingle()

    if (targetError || !target) {
      return jsonResponse({ error: 'User not found' }, 404)
    }

    // Same guard rails as impersonation: an admin resets customers, not peers,
    // and never their own account through the customers list.
    if (target.id === caller.id) {
      return jsonResponse({ error: 'Cannot reset your own password here' }, 400)
    }

    if (target.role === 'super_admin') {
      return jsonResponse({ error: 'Cannot reset a super admin password' }, 403)
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      target.id,
      { password },
    )

    if (updateError) {
      console.error('updateUserById failed', updateError)
      return jsonResponse({ error: 'Failed to set password' }, 500)
    }

    console.log(
      JSON.stringify({
        event: 'admin_set_password',
        admin_id: caller.id,
        target_user_id: target.id,
        at: new Date().toISOString(),
      }),
    )

    return jsonResponse({ email: target.email })
  } catch (err) {
    console.error('Unexpected error', err)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
