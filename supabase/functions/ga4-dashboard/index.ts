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

interface CtaMatrixRow {
  name: string
  location: string
  users: number
}

interface QuestionRow {
  question: string
  users: number
  opens: number
}

interface TimeSeriesDay {
  date: string
  visitors: number
  videoView: number
  viewPlans: number
  generateLead: number
}

interface DashboardPayload {
  overview: {
    homepageUsers: number
    homepageViews: number
    pricingUsers: number
    loginViewUsers: number
    leadUsers: number
    eventsCreated: number
    eventCreators: number
    leadConversionRate: number | null
  }
  video: {
    startedUsers: number
    reached25Users: number | null
    reached50Users: number | null
    reached75Users: number | null
    completedUsers: number
    completionRate: number | null
    milestonesUnavailable: boolean
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
    byNameAndLocation: CtaMatrixRow[] | null
    byNameUnavailable: boolean
    byLocationUnavailable: boolean
    byNameAndLocationUnavailable: boolean
  }
  productInterest: {
    plansViewedUsers: number
    planSelectedUsers: number
    leadUsers: number
    step2Rate: number | null
    step3Rate: number | null
    overallRate: number | null
    formOpenRate: number | null
    plansToLeadRate: number | null
    activationOptionsViewedUsers: number
    activationOptionsClickedUsers: number
    trialActivatedUsers: number
    byPlan: NamedMetric[] | null
    byPlanUnavailable: boolean
    activationBySource: NamedMetric[] | null
    activationBySourceUnavailable: boolean
  }
  login: {
    viewedUsers: number
    startedUsers: number
    successfulUsers: number
    signUpUsers: number
    errorCount: number
  }
  eventCreation: {
    startUsers: number
    eventCount: number
    creatorUsers: number
    scratchCount: number | null
    templateCount: number | null
    methodUnavailable: boolean
  }
  contact: {
    openUsers: number
    leadUsers: number
    conversionRate: number | null
    bySource: NamedMetric[] | null
    bySourceUnavailable: boolean
    opensBySource: NamedMetric[] | null
    opensBySourceUnavailable: boolean
  }
  timeSeries: {
    days: TimeSeriesDay[]
    unavailable: boolean
  }
  trafficSources: {
    items: NamedMetric[] | null
    totalUsers: number
    unavailable: boolean
  }
  meta: {
    startDate: string
    endDate: string
  }
}

const CTA_NAME_LABELS: Record<string, string> = {
  create_event: 'יצירת אירוע',
  start_now: 'מתחילים לשחק',
  view_pricing: 'צפייה במחירים',
  view_activation_options: 'אפשרויות הפעלה',
  login: 'התחברות',
  contact_us: 'יצירת קשר',
  open_scanner: 'פתיחת מסך סריקה',
  open_leaderboard: 'פתיחת לוח שיאים',
}

const CTA_NAME_ALLOW = new Set(Object.keys(CTA_NAME_LABELS))

const CTA_LOCATION_LABELS: Record<string, string> = {
  header: 'תפריט עליון',
  after_video: 'אחרי הסרטון',
  pricing: 'מחירים',
  footer: 'תחתית הדף',
  upgrade_modal: 'חלון שדרוג',
  floating: 'כפתור צף',
  faq: 'אזור השאלות',
  events: 'האירועים שלי',
  wizard: 'אשף הקמה',
  control: 'מרכז בקרה (צור קשר)',
  events_page_trial_badge: 'באדג׳ באירועים שלי',
  wizard_trial_badge: 'באדג׳ באשף',
  trial_scan_limit_modal: 'מודל סיום התנסות',
  plan_limit_modal: 'מודל מגבלת תוכנית',
  control_center: 'מרכז הבקרה',
}

const PLAN_NAME_LABELS: Record<string, string> = {
  independent: 'משחק עצמאי',
  full: 'חוויה מלאה',
  organizations: 'פתרון לארגונים',
}

const PLAN_NAME_ALLOW = new Set(Object.keys(PLAN_NAME_LABELS))

const ACTIVATION_SOURCE_LABELS: Record<string, string> = {
  trial_scan_limit: 'סיום התנסות (סריקות)',
  game_home_trial: 'מרכז בקרה',
  events_page_trial_badge: 'באדג׳ באירועים שלי',
  wizard_trial_badge: 'באדג׳ באשף',
  plan_limit_modal: 'מודל מגבלת תוכנית',
  header: 'כותרת עליונה',
  post_wizard: 'אחרי האשף',
  deep_link: 'קישור ישיר',
}

const ACTIVATION_SOURCE_ALLOW = new Set(Object.keys(ACTIVATION_SOURCE_LABELS))

const CTA_LOCATION_ALLOW = new Set(Object.keys(CTA_LOCATION_LABELS))

const CONTACT_SOURCE_LABELS: Record<string, string> = {
  homepage_contact: 'דף הבית',
  trial_contact: 'מצב התנסות',
  custom_solution: 'פתרון מותאם',
  independent: 'משחק עצמאי',
  full: 'חוויה מלאה',
  organizations: 'פתרון לארגונים',
}

const CONTACT_SOURCE_ALLOW = new Set(Object.keys(CONTACT_SOURCE_LABELS))

const CORE_EVENTS = [
  'view_plans',
  'login_view',
  'generate_lead',
  'event_created',
  'event_creation_start',
  'video_view',
  'video_complete',
  'video_progress',
  'faq_open',
  'cta_click',
  'select_plan',
  'contact_form_open',
  'activation_options_viewed',
  'activation_options_clicked',
  'trial_activated',
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

function mapAllowListedRows(
  rows: Ga4Row[] | undefined,
  labels: Record<string, string>,
  allow: Set<string>,
): NamedMetric[] {
  return (rows ?? [])
    .map((row) => {
      const key = row.dimensionValues?.[0]?.value ?? ''
      return {
        key,
        label: labels[key] ?? key,
        users: Number(row.metricValues?.[0]?.value ?? 0),
      }
    })
    .filter((r) => r.key && r.key !== '(not set)' && allow.has(r.key))
    .map(({ label, users }) => ({ label, users }))
    .sort((a, b) => b.users - a.users)
}

function formatGa4Date(ymd: string): string {
  if (/^\d{8}$/.test(ymd)) {
    return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
  }
  return ymd
}

function eachDateInclusive(startDate: string, endDate: string): string[] {
  const out: string[] = []
  const cur = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

function buildTimeSeriesDays(
  startDate: string,
  endDate: string,
  visitorRows: Ga4Row[] | undefined,
  eventRows: Ga4Row[] | undefined,
): TimeSeriesDay[] {
  const byDate = new Map<string, TimeSeriesDay>()
  for (const date of eachDateInclusive(startDate, endDate)) {
    byDate.set(date, {
      date,
      visitors: 0,
      videoView: 0,
      viewPlans: 0,
      generateLead: 0,
    })
  }

  for (const row of visitorRows ?? []) {
    const date = formatGa4Date(row.dimensionValues?.[0]?.value ?? '')
    const day = byDate.get(date)
    if (!day) continue
    day.visitors = Number(row.metricValues?.[0]?.value ?? 0)
  }

  for (const row of eventRows ?? []) {
    const date = formatGa4Date(row.dimensionValues?.[0]?.value ?? '')
    const eventName = row.dimensionValues?.[1]?.value ?? ''
    const day = byDate.get(date)
    if (!day) continue
    const users = Number(row.metricValues?.[0]?.value ?? 0)
    if (eventName === 'video_view') day.videoView = users
    if (eventName === 'view_plans') day.viewPlans = users
    if (eventName === 'generate_lead') day.generateLead = users
  }

  return [...byDate.values()]
}

const CAMPAIGN_SOURCE_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  fb: 'Facebook',
  meta: 'Meta',
  instagram: 'Instagram',
  ig: 'Instagram',
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter',
  x: 'X / Twitter',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  newsletter: 'ניוזלטר',
  email: 'אימייל',
  whatsapp: 'WhatsApp',
}

function categorizeTrafficSource(raw: string): string {
  const source = raw.trim()
  const lower = source.toLowerCase()
  if (!source || lower === '(not set)' || lower === 'not set') return 'אחר'
  if (lower === '(direct)' || lower === 'direct') return 'ישיר'
  if (lower.includes('google')) return 'Google'
  if (CAMPAIGN_SOURCE_LABELS[lower]) return CAMPAIGN_SOURCE_LABELS[lower]
  // Bare domains without known campaign mapping → referral bucket
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(source) && !source.includes(' ')) {
    return 'הפניה מאתר אחר'
  }
  // Preserve meaningful named / UTM campaign sources
  if (source.length <= 40 && !/^\(/.test(source)) {
    return source
  }
  return 'אחר'
}

function groupTrafficSources(rows: Ga4Row[] | undefined): NamedMetric[] {
  const buckets = new Map<string, number>()
  for (const row of rows ?? []) {
    const raw = row.dimensionValues?.[0]?.value ?? ''
    const users = Number(row.metricValues?.[0]?.value ?? 0)
    if (users <= 0) continue
    const label = categorizeTrafficSource(raw)
    buckets.set(label, (buckets.get(label) ?? 0) + users)
  }
  return [...buckets.entries()]
    .map(([label, users]) => ({ label, users }))
    .filter((r) => r.users > 0)
    .sort((a, b) => b.users - a.users)
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
      .eq('id', user.id)
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
      limit: 50,
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

    const leadBySourcePromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'customEvent:contact_source' }],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'generate_lead' },
        },
      },
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 20,
    })

    const contactOpenBySourcePromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'customEvent:contact_source' }],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'contact_form_open' },
        },
      },
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 20,
    })

    const selectPlanByNamePromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'customEvent:plan_name' }],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'select_plan' },
        },
      },
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 10,
    })

    const activationBySourcePromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'customEvent:source' }],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'activation_options_viewed' },
        },
      },
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 20,
    })

    const videoProgressPromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'customEvent:progress_percent' }],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'video_progress' },
        },
      },
      limit: 10,
    })

    const ctaMatrixPromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [
        { name: 'customEvent:cta_name' },
        { name: 'customEvent:cta_location' },
      ],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'cta_click' },
        },
      },
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 50,
    })

    // Daily unique users for homepage visitors (page_view on /)
    const timeSeriesVisitorsPromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'totalUsers' }],
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
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      limit: 400,
    })

    // Daily unique users for key events
    const timeSeriesEventsPromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'date' }, { name: 'eventName' }],
      metrics: [{ name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: ['video_view', 'view_plans', 'generate_lead'] },
        },
      },
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      limit: 10000,
    })

    // Acquisition / session source distribution
    const trafficSourcesPromise = runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 50,
    })

    const [
      core,
      homepage,
      faqQuestions,
      ctaByName,
      ctaByLocation,
      creationMethod,
      leadBySource,
      contactOpenBySource,
      selectPlanByName,
      activationBySource,
      videoProgress,
      ctaMatrix,
      timeSeriesVisitors,
      timeSeriesEvents,
      trafficSourcesReport,
    ] = await Promise.all([
      corePromise,
      homepagePromise,
      faqQuestionsPromise,
      ctaByNamePromise,
      ctaByLocationPromise,
      creationMethodPromise,
      leadBySourcePromise,
      contactOpenBySourcePromise,
      selectPlanByNamePromise,
      activationBySourcePromise,
      videoProgressPromise,
      ctaMatrixPromise,
      timeSeriesVisitorsPromise,
      timeSeriesEventsPromise,
      trafficSourcesPromise,
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

    let leadBySourceRows: NamedMetric[] | null = null
    let bySourceUnavailable = false
    if (leadBySource.error) {
      bySourceUnavailable = true
      console.warn('lead by contact_source unavailable', leadBySource.error.message)
    } else {
      leadBySourceRows = mapAllowListedRows(
        leadBySource.rows,
        CONTACT_SOURCE_LABELS,
        CONTACT_SOURCE_ALLOW,
      )
    }

    let contactOpensBySourceRows: NamedMetric[] | null = null
    let opensBySourceUnavailable = false
    if (contactOpenBySource.error) {
      opensBySourceUnavailable = true
      console.warn('contact_form_open by contact_source unavailable', contactOpenBySource.error.message)
    } else {
      contactOpensBySourceRows = mapAllowListedRows(
        contactOpenBySource.rows,
        CONTACT_SOURCE_LABELS,
        CONTACT_SOURCE_ALLOW,
      )
    }

    let planByNameRows: NamedMetric[] | null = null
    let byPlanUnavailable = false
    if (selectPlanByName.error) {
      byPlanUnavailable = true
      console.warn('select_plan by plan_name unavailable', selectPlanByName.error.message)
    } else {
      planByNameRows = mapAllowListedRows(selectPlanByName.rows, PLAN_NAME_LABELS, PLAN_NAME_ALLOW)
    }

    let activationBySourceRows: NamedMetric[] | null = null
    let activationBySourceUnavailable = false
    if (activationBySource.error) {
      activationBySourceUnavailable = true
      console.warn('activation_options_viewed by source unavailable', activationBySource.error.message)
    } else {
      activationBySourceRows = mapAllowListedRows(
        activationBySource.rows,
        ACTIVATION_SOURCE_LABELS,
        ACTIVATION_SOURCE_ALLOW,
      )
    }

    let reached25Users: number | null = 0
    let reached50Users: number | null = 0
    let reached75Users: number | null = 0
    let milestonesUnavailable = false
    if (videoProgress.error) {
      milestonesUnavailable = true
      reached25Users = null
      reached50Users = null
      reached75Users = null
      console.warn('video_progress by progress_percent unavailable', videoProgress.error.message)
    } else {
      for (const row of videoProgress.rows ?? []) {
        const key = String(row.dimensionValues?.[0]?.value ?? '').replace(/\.0$/, '')
        const users = Number(row.metricValues?.[0]?.value ?? 0)
        if (key === '25') reached25Users = users
        if (key === '50') reached50Users = users
        if (key === '75') reached75Users = users
      }
    }

    let byNameAndLocation: CtaMatrixRow[] | null = null
    let byNameAndLocationUnavailable = false
    if (ctaMatrix.error) {
      byNameAndLocationUnavailable = true
      console.warn('CTA name×location unavailable', ctaMatrix.error.message)
    } else {
      byNameAndLocation = (ctaMatrix.rows ?? [])
        .map((row) => {
          const nameKey = row.dimensionValues?.[0]?.value ?? ''
          const locKey = row.dimensionValues?.[1]?.value ?? ''
          return {
            nameKey,
            locKey,
            name: CTA_NAME_LABELS[nameKey] ?? nameKey,
            location: CTA_LOCATION_LABELS[locKey] ?? locKey,
            users: Number(row.metricValues?.[0]?.value ?? 0),
          }
        })
        .filter(
          (r) =>
            CTA_NAME_ALLOW.has(r.nameKey) &&
            CTA_LOCATION_ALLOW.has(r.locKey) &&
            r.users > 0,
        )
        .map(({ name, location, users }) => ({ name, location, users }))
        .sort((a, b) => b.users - a.users)
    }

    let timeSeriesDays: TimeSeriesDay[] = eachDateInclusive(startDate, endDate).map((date) => ({
      date,
      visitors: 0,
      videoView: 0,
      viewPlans: 0,
      generateLead: 0,
    }))
    let timeSeriesUnavailable = false
    if (timeSeriesVisitors.error && timeSeriesEvents.error) {
      timeSeriesUnavailable = true
      console.warn(
        'time series unavailable',
        timeSeriesVisitors.error?.message,
        timeSeriesEvents.error?.message,
      )
    } else {
      if (timeSeriesVisitors.error) {
        console.warn('time series visitors unavailable', timeSeriesVisitors.error.message)
      }
      if (timeSeriesEvents.error) {
        console.warn('time series events unavailable', timeSeriesEvents.error.message)
      }
      timeSeriesDays = buildTimeSeriesDays(
        startDate,
        endDate,
        timeSeriesVisitors.error ? [] : timeSeriesVisitors.rows,
        timeSeriesEvents.error ? [] : timeSeriesEvents.rows,
      )
    }

    let trafficItems: NamedMetric[] | null = null
    let trafficTotalUsers = 0
    let trafficUnavailable = false
    if (trafficSourcesReport.error) {
      trafficUnavailable = true
      console.warn('traffic sources unavailable', trafficSourcesReport.error.message)
    } else {
      trafficItems = groupTrafficSources(trafficSourcesReport.rows)
      trafficTotalUsers = trafficItems.reduce((sum, r) => sum + r.users, 0)
    }

    const contactOpenUsers = getEvent(events, 'contact_form_open').users
    const activationViewed = getEvent(events, 'activation_options_viewed').users
    const activationClicked = getEvent(events, 'activation_options_clicked').users
    const trialActivated = getEvent(events, 'trial_activated').users
    const eventCreationStart = getEvent(events, 'event_creation_start').users

    const payload: DashboardPayload = {
      overview: {
        homepageUsers,
        homepageViews,
        pricingUsers: plansViewed,
        loginViewUsers: getEvent(events, 'login_view').users,
        leadUsers,
        eventsCreated: eventCreated.count,
        eventCreators: eventCreated.users,
        leadConversionRate: rate(leadUsers, homepageUsers),
      },
      video: {
        startedUsers: videoStarted,
        reached25Users,
        reached50Users,
        reached75Users,
        completedUsers: videoCompleted,
        completionRate: rate(videoCompleted, videoStarted),
        milestonesUnavailable,
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
        byNameAndLocation,
        byNameUnavailable,
        byLocationUnavailable,
        byNameAndLocationUnavailable,
      },
      productInterest: {
        plansViewedUsers: plansViewed,
        planSelectedUsers: planSelected,
        leadUsers,
        step2Rate: rate(planSelected, plansViewed),
        step3Rate: rate(leadUsers, planSelected),
        overallRate: rate(leadUsers, plansViewed),
        formOpenRate: rate(contactOpenUsers, plansViewed),
        plansToLeadRate: rate(leadUsers, plansViewed),
        activationOptionsViewedUsers: activationViewed,
        activationOptionsClickedUsers: activationClicked,
        trialActivatedUsers: trialActivated,
        byPlan: planByNameRows,
        byPlanUnavailable,
        activationBySource: activationBySourceRows,
        activationBySourceUnavailable,
      },
      login: {
        viewedUsers: getEvent(events, 'login_view').users,
        startedUsers: getEvent(events, 'login_start').users,
        successfulUsers: getEvent(events, 'login').users,
        signUpUsers: getEvent(events, 'sign_up').users,
        errorCount: getEvent(events, 'login_error').count,
      },
      eventCreation: {
        startUsers: eventCreationStart,
        eventCount: eventCreated.count,
        creatorUsers: eventCreated.users,
        scratchCount,
        templateCount,
        methodUnavailable,
      },
      contact: {
        openUsers: contactOpenUsers,
        leadUsers,
        conversionRate: rate(leadUsers, contactOpenUsers),
        bySource: leadBySourceRows,
        bySourceUnavailable,
        opensBySource: contactOpensBySourceRows,
        opensBySourceUnavailable,
      },
      timeSeries: {
        days: timeSeriesDays,
        unavailable: timeSeriesUnavailable,
      },
      trafficSources: {
        items: trafficItems,
        totalUsers: trafficTotalUsers,
        unavailable: trafficUnavailable,
      },
      meta: { startDate, endDate },
    }

    return jsonResponse(payload)
  } catch (err) {
    console.error('Unexpected error', err)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
