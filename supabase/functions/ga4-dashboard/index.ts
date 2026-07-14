// Edge Function: ga4-dashboard
// Fetches GA4 Analytics Data API reports server-side and returns a ready-to-render
// payload for the Admin Analytics tab.
//
// Auth: requires a valid user JWT + user_profiles.role === 'super_admin'.
//
// Required secrets (supabase secrets set):
//   GA4_PROPERTY_ID                    - numeric GA4 property id (Admin → Property settings)
//   GOOGLE_SERVICE_ACCOUNT_EMAIL       - service account with Viewer on the GA4 property
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY - PEM private key (\n escaped as \\n is fine)
// Automatically provided by Supabase:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type DatePreset = 'today' | '7d' | '14d' | '28d' | 'custom'

interface RequestBody {
  startDate?: string
  endDate?: string
  preset?: DatePreset
}

interface NamedMetric {
  label: string
  users: number
}

interface QuestionRow {
  question: string
  users: number
  opens: number
}

interface DashboardPayload {
  overview: {
    homepageUsers: number
    homepageViews: number
    pricingUsers: number
    loginViewUsers: number
    leadUsers: number
    eventsCreated: number
  }
  video: {
    startedUsers: number
    completedUsers: number
    completionRate: number | null
  }
  homepageInterest: {
    faqUsers: number
    questions: QuestionRow[] | null
    questionsUnavailable: boolean
  }
  ctas: {
    totalUsers: number
    byName: NamedMetric[] | null
    byLocation: NamedMetric[] | null
    byNameUnavailable: boolean
    byLocationUnavailable: boolean
  }
  productInterest: {
    plansViewedUsers: number
    planSelectedUsers: number
    leadUsers: number
    step2Rate: number | null
    step3Rate: number | null
    overallRate: number | null
  }
  login: {
    viewedUsers: number
    startedUsers: number
    successfulUsers: number
    signUpUsers: number
    errorCount: number
  }
  eventCreation: {
    eventCount: number
    creatorUsers: number
    scratchCount: number | null
    templateCount: number | null
    methodUnavailable: boolean
  }
  meta: {
    startDate: string
    endDate: string
  }
}

const CTA_NAME_LABELS: Record<string, string> = {
  create_event: 'יצירת אירוע',
  start_now: 'התחלה עכשיו',
  view_pricing: 'צפייה במחירים',
  login: 'התחברות',
}

const CTA_NAME_ALLOW = new Set(Object.keys(CTA_NAME_LABELS))

const CTA_LOCATION_LABELS: Record<string, string> = {
  header: 'כותרת עליונה',
  after_video: 'אחרי הסרטון',
  pricing: 'אזור המחירים',
  footer: 'תחתית הדף',
}

const CTA_LOCATION_ALLOW = new Set(Object.keys(CTA_LOCATION_LABELS))

const CORE_EVENTS = [
  'view_plans',
  'login_view',
  'generate_lead',
  'event_created',
  'video_view',
  'video_complete',
  'faq_open',
  'cta_click',
  'select_plan',
  'login_start',
  'login',
  'sign_up',
  'login_error',
] as const

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoYmd(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function resolveDateRange(body: RequestBody): { startDate: string; endDate: string } | { error: string } {
  const end = body.endDate || todayYmd()
  const preset = body.preset || '7d'

  if (preset === 'custom') {
    if (!body.startDate || !body.endDate) {
      return { error: 'Custom range requires startDate and endDate (YYYY-MM-DD)' }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) {
      return { error: 'Dates must be YYYY-MM-DD' }
    }
    if (body.startDate > body.endDate) {
      return { error: 'startDate must be on or before endDate' }
    }
    return { startDate: body.startDate, endDate: body.endDate }
  }

  if (preset === 'today') return { startDate: end, endDate: end }
  if (preset === '14d') return { startDate: daysAgoYmd(13), endDate: end }
  if (preset === '28d') return { startDate: daysAgoYmd(27), endDate: end }
  // default / 7d — last 7 days including today
  return { startDate: daysAgoYmd(6), endDate: end }
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function base64url(data: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data)
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data)
  } else {
    bytes = data
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getGoogleAccessToken(email: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const assertion = `${unsigned}.${base64url(signature)}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!tokenRes.ok) {
    const detail = await tokenRes.text()
    console.error('Google token error', tokenRes.status, detail)
    throw new Error('Failed to obtain Google access token')
  }

  const tokenJson = await tokenRes.json()
  if (!tokenJson.access_token) throw new Error('Google token response missing access_token')
  return tokenJson.access_token as string
}

interface Ga4Row {
  dimensionValues?: { value?: string }[]
  metricValues?: { value?: string }[]
}

interface Ga4Report {
  rows?: Ga4Row[]
  error?: { message?: string; status?: string }
}

async function runReport(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>,
): Promise<Ga4Report> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  const json = await res.json()
  if (!res.ok) {
    console.error('GA4 runReport error', res.status, json)
    return { error: { message: json?.error?.message ?? 'GA4 report failed', status: String(res.status) } }
  }
  return json as Ga4Report
}

function metricMapFromEventRows(rows: Ga4Row[] | undefined): Map<string, { users: number; count: number }> {
  const map = new Map<string, { users: number; count: number }>()
  for (const row of rows ?? []) {
    const name = row.dimensionValues?.[0]?.value ?? ''
    const users = Number(row.metricValues?.[0]?.value ?? 0)
    const count = Number(row.metricValues?.[1]?.value ?? 0)
    map.set(name, { users, count })
  }
  return map
}

function getEvent(map: Map<string, { users: number; count: number }>, name: string) {
  return map.get(name) ?? { users: 0, count: 0 }
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
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || profile?.role !== 'super_admin') {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const propertyId = Deno.env.get('GA4_PROPERTY_ID')
    const saEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    const saKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')

    if (!propertyId || !saEmail || !saKey) {
      return jsonResponse(
        {
          error: 'GA4 not configured',
          code: 'GA4_NOT_CONFIGURED',
          missing: [
            !propertyId && 'GA4_PROPERTY_ID',
            !saEmail && 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
            !saKey && 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
          ].filter(Boolean),
        },
        503,
      )
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody
    const range = resolveDateRange(body)
    if ('error' in range) {
      return jsonResponse({ error: range.error }, 400)
    }
    const { startDate, endDate } = range
    const dateRanges = [{ startDate, endDate }]

    let accessToken: string
    try {
      accessToken = await getGoogleAccessToken(saEmail, saKey)
    } catch (err) {
      console.error(err)
      return jsonResponse({ error: 'Failed to authenticate with Google', code: 'GOOGLE_AUTH_FAILED' }, 502)
    }

    // Report A — core events (batched metrics by eventName)
    const corePromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: [...CORE_EVENTS] },
        },
      },
      limit: 50,
    })

    // Report B — homepage page_view users + views
    const homepagePromise = runReport(accessToken, propertyId, {
      dateRanges,
      metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: { matchType: 'EXACT', value: 'page_view' },
              },
            },
            {
              filter: {
                fieldName: 'pagePath',
                stringFilter: { matchType: 'EXACT', value: '/' },
              },
            },
          ],
        },
      },
    })

    // Soft-fail custom dimension reports
    const faqQuestionsPromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'customEvent:question' }],
      metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'faq_open' },
        },
      },
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 10,
    })

    const ctaByNamePromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'customEvent:cta_name' }],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'cta_click' },
        },
      },
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 20,
    })

    const ctaByLocationPromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'customEvent:cta_location' }],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'cta_click' },
        },
      },
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 20,
    })

    const creationMethodPromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'customEvent:creation_method' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'event_created' },
        },
      },
      limit: 10,
    })

    const [core, homepage, faqQuestions, ctaByName, ctaByLocation, creationMethod] =
      await Promise.all([
        corePromise,
        homepagePromise,
        faqQuestionsPromise,
        ctaByNamePromise,
        ctaByLocationPromise,
        creationMethodPromise,
      ])

    if (core.error) {
      return jsonResponse(
        { error: 'Failed to load analytics data', detail: core.error.message, code: 'GA4_CORE_FAILED' },
        502,
      )
    }
    if (homepage.error) {
      return jsonResponse(
        {
          error: 'Failed to load homepage metrics',
          detail: homepage.error.message,
          code: 'GA4_HOMEPAGE_FAILED',
        },
        502,
      )
    }

    const events = metricMapFromEventRows(core.rows)
    const homepageUsers = Number(homepage.rows?.[0]?.metricValues?.[0]?.value ?? 0)
    const homepageViews = Number(homepage.rows?.[0]?.metricValues?.[1]?.value ?? 0)

    const videoStarted = getEvent(events, 'video_view').users
    const videoCompleted = getEvent(events, 'video_complete').users
    const plansViewed = getEvent(events, 'view_plans').users
    const planSelected = getEvent(events, 'select_plan').users
    const leadUsers = getEvent(events, 'generate_lead').users
    const eventCreated = getEvent(events, 'event_created')

    let questions: QuestionRow[] | null = null
    let questionsUnavailable = false
    if (faqQuestions.error) {
      questionsUnavailable = true
      console.warn('FAQ questions report unavailable', faqQuestions.error.message)
    } else {
      questions = (faqQuestions.rows ?? [])
        .map((row) => ({
          question: row.dimensionValues?.[0]?.value || '(ללא טקסט)',
          users: Number(row.metricValues?.[0]?.value ?? 0),
          opens: Number(row.metricValues?.[1]?.value ?? 0),
        }))
        .filter((q) => q.question && q.question !== '(not set)')
    }

    let byName: NamedMetric[] | null = null
    let byNameUnavailable = false
    if (ctaByName.error) {
      byNameUnavailable = true
      console.warn('CTA by name unavailable', ctaByName.error.message)
    } else {
      byName = (ctaByName.rows ?? [])
        .map((row) => {
          const key = row.dimensionValues?.[0]?.value ?? ''
          return {
            key,
            label: CTA_NAME_LABELS[key] ?? key,
            users: Number(row.metricValues?.[0]?.value ?? 0),
          }
        })
        .filter((r) => CTA_NAME_ALLOW.has(r.key))
        .map(({ label, users }) => ({ label, users }))
        .sort((a, b) => b.users - a.users)
    }

    let byLocation: NamedMetric[] | null = null
    let byLocationUnavailable = false
    if (ctaByLocation.error) {
      byLocationUnavailable = true
      console.warn('CTA by location unavailable', ctaByLocation.error.message)
    } else {
      byLocation = (ctaByLocation.rows ?? [])
        .map((row) => {
          const key = row.dimensionValues?.[0]?.value ?? ''
          return {
            key,
            label: CTA_LOCATION_LABELS[key] ?? key,
            users: Number(row.metricValues?.[0]?.value ?? 0),
          }
        })
        .filter((r) => CTA_LOCATION_ALLOW.has(r.key))
        .map(({ label, users }) => ({ label, users }))
        .sort((a, b) => b.users - a.users)
    }

    let scratchCount: number | null = 0
    let templateCount: number | null = 0
    let methodUnavailable = false
    if (creationMethod.error) {
      methodUnavailable = true
      scratchCount = null
      templateCount = null
      console.warn('creation_method unavailable', creationMethod.error.message)
    } else {
      scratchCount = 0
      templateCount = 0
      for (const row of creationMethod.rows ?? []) {
        const key = row.dimensionValues?.[0]?.value ?? ''
        const count = Number(row.metricValues?.[0]?.value ?? 0)
        if (key === 'scratch') scratchCount = count
        if (key === 'template') templateCount = count
      }
    }

    const payload: DashboardPayload = {
      overview: {
        homepageUsers,
        homepageViews,
        pricingUsers: plansViewed,
        loginViewUsers: getEvent(events, 'login_view').users,
        leadUsers,
        eventsCreated: eventCreated.count,
      },
      video: {
        startedUsers: videoStarted,
        completedUsers: videoCompleted,
        completionRate: rate(videoCompleted, videoStarted),
      },
      homepageInterest: {
        faqUsers: getEvent(events, 'faq_open').users,
        questions,
        questionsUnavailable,
      },
      ctas: {
        totalUsers: getEvent(events, 'cta_click').users,
        byName,
        byLocation,
        byNameUnavailable,
        byLocationUnavailable,
      },
      productInterest: {
        plansViewedUsers: plansViewed,
        planSelectedUsers: planSelected,
        leadUsers,
        step2Rate: rate(planSelected, plansViewed),
        step3Rate: rate(leadUsers, planSelected),
        overallRate: rate(leadUsers, plansViewed),
      },
      login: {
        viewedUsers: getEvent(events, 'login_view').users,
        startedUsers: getEvent(events, 'login_start').users,
        successfulUsers: getEvent(events, 'login').users,
        signUpUsers: getEvent(events, 'sign_up').users,
        errorCount: getEvent(events, 'login_error').count,
      },
      eventCreation: {
        eventCount: eventCreated.count,
        creatorUsers: eventCreated.users,
        scratchCount,
        templateCount,
        methodUnavailable,
      },
      meta: { startDate, endDate },
    }

    return jsonResponse(payload)
  } catch (err) {
    console.error('Unexpected error', err)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
