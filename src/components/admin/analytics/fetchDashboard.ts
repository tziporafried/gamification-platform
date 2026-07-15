import { supabase } from '@/lib/supabase'
import {
  AnalyticsDashboardData,
  AnalyticsFetchError,
  AnalyticsFetchParams,
  type AnalyticsFetchErrorCode,
} from './types'

type ErrorBody = {
  error?: string
  code?: string
  missing?: string[]
  detail?: string
}

async function readErrorBody(error: unknown): Promise<ErrorBody | null> {
  const ctx = (error as { context?: Response })?.context
  if (!ctx || typeof ctx.json !== 'function') return null
  try {
    return await ctx.clone().json()
  } catch {
    return null
  }
}

function humanizeGa4Detail(detail?: string): string | undefined {
  if (!detail) return undefined
  if (/SERVICE_DISABLED|has not been used|is disabled/i.test(detail)) {
    return 'יש להפעיל את Google Analytics Data API בפרויקט Google Cloud של ה-service account.'
  }
  if (/permission|does not have|insufficient|User does not have/i.test(detail)) {
    return 'ל-service account אין הרשאת Viewer על ה-property ב-GA4 (Property access management).'
  }
  if (/not found|property/i.test(detail) && /404|INVALID_ARGUMENT/i.test(detail)) {
    return 'ייתכן ש-GA4_PROPERTY_ID שגוי (צריך Property ID מספרי, לא G-...).'
  }
  return detail
}

function throwFromBody(body: ErrorBody | null, fallbackMessage: string): never {
  if (body?.code === 'GA4_NOT_CONFIGURED') {
    throw new AnalyticsFetchError(
      'חיבור GA4 עדיין לא הוגדר בשרת',
      'GA4_NOT_CONFIGURED',
      body.missing,
    )
  }
  const code = (body?.code as AnalyticsFetchErrorCode) || 'UNKNOWN'
  const detailHint = humanizeGa4Detail(body?.detail)
  throw new AnalyticsFetchError(
    detailHint || body?.error || fallbackMessage,
    code,
    body?.missing,
    body?.detail,
  )
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

/** Normalize older Edge Function payloads so the UI can render safely. */
function normalizePayload(raw: AnalyticsDashboardData): AnalyticsDashboardData {
  const payload = { ...raw }

  payload.overview = {
    ...payload.overview,
    eventCreators: payload.overview.eventCreators ?? payload.eventCreation?.creatorUsers ?? 0,
    leadConversionRate:
      payload.overview.leadConversionRate ??
      rate(payload.overview.leadUsers ?? 0, payload.overview.homepageUsers ?? 0),
  }

  payload.video = {
    startedUsers: payload.video?.startedUsers ?? 0,
    completedUsers: payload.video?.completedUsers ?? 0,
    completionRate: payload.video?.completionRate ?? null,
    reached25Users: payload.video?.reached25Users ?? null,
    reached50Users: payload.video?.reached50Users ?? null,
    reached75Users: payload.video?.reached75Users ?? null,
    milestonesUnavailable: payload.video?.milestonesUnavailable ?? true,
  }

  if (!payload.contact) {
    payload.contact = {
      openUsers: 0,
      leadUsers: payload.overview?.leadUsers ?? 0,
      conversionRate: null,
      bySource: null,
      bySourceUnavailable: true,
      opensBySource: null,
      opensBySourceUnavailable: true,
    }
  } else {
    payload.contact.opensBySource ??= null
    payload.contact.opensBySourceUnavailable ??= true
  }

  if (!payload.productInterest) {
    payload.productInterest = {
      plansViewedUsers: payload.overview?.pricingUsers ?? 0,
      planSelectedUsers: 0,
      leadUsers: payload.overview?.leadUsers ?? 0,
      step2Rate: null,
      step3Rate: null,
      overallRate: null,
      formOpenRate: null,
      plansToLeadRate: null,
      activationOptionsViewedUsers: 0,
      activationOptionsClickedUsers: 0,
      trialActivatedUsers: 0,
      byPlan: null,
      byPlanUnavailable: true,
      activationBySource: null,
      activationBySourceUnavailable: true,
    }
  } else {
    payload.productInterest.activationOptionsViewedUsers ??= 0
    payload.productInterest.activationOptionsClickedUsers ??= 0
    payload.productInterest.trialActivatedUsers ??= 0
    payload.productInterest.byPlan ??= null
    payload.productInterest.byPlanUnavailable ??= true
    payload.productInterest.activationBySource ??= null
    payload.productInterest.activationBySourceUnavailable ??= true
    payload.productInterest.formOpenRate ??= rate(
      payload.contact.openUsers,
      payload.productInterest.plansViewedUsers,
    )
    payload.productInterest.plansToLeadRate ??=
      payload.productInterest.overallRate ??
      rate(payload.productInterest.leadUsers, payload.productInterest.plansViewedUsers)
  }

  if (!payload.ctas) {
    payload.ctas = {
      totalUsers: 0,
      byName: null,
      byLocation: null,
      byNameAndLocation: null,
      byNameUnavailable: true,
      byLocationUnavailable: true,
      byNameAndLocationUnavailable: true,
    }
  } else {
    payload.ctas.byNameAndLocation ??= null
    payload.ctas.byNameAndLocationUnavailable ??= true
  }

  if (!payload.eventCreation) {
    payload.eventCreation = {
      startUsers: 0,
      eventCount: payload.overview?.eventsCreated ?? 0,
      creatorUsers: payload.overview?.eventCreators ?? 0,
      scratchCount: null,
      templateCount: null,
      methodUnavailable: true,
    }
  } else {
    payload.eventCreation.startUsers ??= 0
  }

  if (!payload.timeSeries) {
    payload.timeSeries = { days: [], unavailable: true }
  } else {
    payload.timeSeries.days ??= []
    payload.timeSeries.unavailable ??= false
    payload.timeSeries.days = payload.timeSeries.days.map((day) => ({
      ...day,
      visitors: Number(day.visitors ?? 0),
      newUsers: Number(day.newUsers ?? 0),
      videoView: Number(day.videoView ?? 0),
      videoComplete: Number(day.videoComplete ?? 0),
      viewPlans: Number(day.viewPlans ?? 0),
      selectPlan: Number(day.selectPlan ?? 0),
      contactFormOpen: Number(day.contactFormOpen ?? 0),
      generateLead: Number(day.generateLead ?? 0),
      ctaClick: Number(day.ctaClick ?? 0),
      faqOpen: Number(day.faqOpen ?? 0),
      loginView: Number(day.loginView ?? 0),
      signUp: Number(day.signUp ?? 0),
      eventCreated: Number(day.eventCreated ?? 0),
    }))
  }

  if (!payload.trafficSources) {
    payload.trafficSources = {
      items: null,
      totalUsers: 0,
      unavailable: true,
    }
  } else {
    payload.trafficSources.items ??= null
    payload.trafficSources.totalUsers ??= 0
    payload.trafficSources.unavailable ??= false
  }

  if (!payload.utm) {
    payload.utm = {
      taggedVisitors: 0,
      sourceBreakdown: null,
      mediumBreakdown: null,
      campaignBreakdown: null,
      contentBreakdown: null,
      linkPerformance: null,
      unavailable: true,
      unavailableParams: ['utm_source', 'utm_content'],
    }
  } else {
    payload.utm.taggedVisitors ??= 0
    payload.utm.sourceBreakdown ??= null
    payload.utm.mediumBreakdown ??= null
    payload.utm.campaignBreakdown ??= null
    payload.utm.contentBreakdown ??= null
    payload.utm.linkPerformance ??= null
    payload.utm.unavailable ??= false
    payload.utm.unavailableParams ??= []
    payload.utm.linkPerformance = payload.utm.linkPerformance?.map((row) => ({
      ...row,
      source: row.source ?? null,
    })) ?? null
  }

  return payload
}

export async function fetchAnalyticsDashboard(
  params: AnalyticsFetchParams,
): Promise<AnalyticsDashboardData> {
  const { data, error } = await supabase.functions.invoke('ga4-dashboard', {
    body: {
      preset: params.preset,
      startDate: params.startDate,
      endDate: params.endDate,
    },
  })

  if (error) {
    const status = (error as { context?: Response }).context?.status
    if (status === 401) {
      throw new AnalyticsFetchError('יש להתחבר מחדש כדי לצפות באנליטיקות', 'UNAUTHORIZED')
    }
    if (status === 403) {
      throw new AnalyticsFetchError('אין הרשאה לצפות באנליטיקות', 'FORBIDDEN')
    }

    const body = await readErrorBody(error)
    throwFromBody(body, error.message || 'שגיאה בטעינת אנליטיקות')
  }

  if (data && typeof data === 'object' && 'error' in data && !('overview' in data)) {
    throwFromBody(data as ErrorBody, 'שגיאה בטעינת אנליטיקות')
  }

  if (!data || typeof data !== 'object' || !('overview' in data)) {
    throw new AnalyticsFetchError('תשובה לא תקינה מהשרת', 'UNKNOWN')
  }

  return normalizePayload(data as AnalyticsDashboardData)
}
