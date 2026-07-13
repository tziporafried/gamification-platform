// Edge Function: notify-contact-request
// Sends an email to all super admins when a new contact/upgrade request is created.
//
// Invoked from the frontend (PlansPage) after a row is inserted into
// public.contact_upgrade_requests, with body: { requestId: string }.
//
// Runs with the service-role key so it can read super-admin emails and the
// request row regardless of RLS (contact requests may be anonymous).
//
// Required secrets (set via `supabase secrets set`):
//   RESEND_API_KEY   - API key from https://resend.com
//   MAIL_FROM        - verified sender, e.g. "Gamification <noreply@yourdomain.com>"
//                      (falls back to Resend's onboarding@resend.dev for testing)
// Automatically provided by Supabase:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const LIMIT_TYPE_LABELS: Record<string, string> = {
  'plan-independent': 'משחק עצמאי',
  'plan-full': 'חוויה מלאה',
  'plan-organizations': 'פתרון לארגונים',
}

function esc(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { requestId } = await req.json().catch(() => ({ requestId: null }))
    if (!requestId) {
      return new Response(JSON.stringify({ error: 'Missing requestId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch the contact request
    const { data: request, error: reqError } = await supabase
      .from('contact_upgrade_requests')
      .select('id, full_name, email, phone, notes, limit_type, created_at')
      .eq('id', requestId)
      .single()

    if (reqError || !request) {
      console.error('Request not found', reqError)
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch all super-admin emails
    const { data: admins, error: adminError } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('role', 'super_admin')

    if (adminError) {
      console.error('Failed to load super admins', adminError)
      return new Response(JSON.stringify({ error: 'Failed to load admins' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const recipients = (admins ?? [])
      .map((a) => a.email)
      .filter((e): e is string => !!e)

    if (recipients.length === 0) {
      console.warn('No super admins to notify')
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: 'no super admins' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.error('RESEND_API_KEY is not set')
      return new Response(JSON.stringify({ error: 'Email not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const from = Deno.env.get('MAIL_FROM') ?? 'Gamification <onboarding@resend.dev>'
    const planLabel = LIMIT_TYPE_LABELS[request.limit_type] ?? request.limit_type

    const html = `
      <div dir="rtl" style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6;">
        <h2 style="margin: 0 0 16px;">פנייה חדשה מהאתר 🎉</h2>
        <p style="margin: 0 0 16px;">התקבלה בקשת יצירת קשר / שדרוג חדשה:</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
          <tr><td style="padding: 6px 12px; font-weight: bold; background: #f4f4f5;">שם מלא</td><td style="padding: 6px 12px;">${esc(request.full_name)}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold; background: #f4f4f5;">אימייל</td><td style="padding: 6px 12px;"><a href="mailto:${esc(request.email)}">${esc(request.email)}</a></td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold; background: #f4f4f5;">טלפון</td><td style="padding: 6px 12px;"><a href="tel:${esc(request.phone)}">${esc(request.phone)}</a></td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold; background: #f4f4f5;">מסלול</td><td style="padding: 6px 12px;">${esc(planLabel)}</td></tr>
          ${request.notes ? `<tr><td style="padding: 6px 12px; font-weight: bold; background: #f4f4f5; vertical-align: top;">הערות</td><td style="padding: 6px 12px; white-space: pre-line;">${esc(request.notes)}</td></tr>` : ''}
        </table>
        <p style="margin: 20px 0 0; color: #71717a; font-size: 13px;">
          התקבל: ${new Date(request.created_at).toLocaleString('he-IL')}
        </p>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: `פנייה חדשה: ${request.full_name} (${planLabel})`,
        reply_to: request.email,
        html,
      }),
    })

    if (!emailRes.ok) {
      const detail = await emailRes.text()
      console.error('Resend error', emailRes.status, detail)
      return new Response(
        JSON.stringify({ error: 'Email send failed', detail }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(
      JSON.stringify({ ok: true, sent: recipients.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Unexpected error', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
