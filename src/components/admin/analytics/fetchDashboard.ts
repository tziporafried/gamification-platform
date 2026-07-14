import { supabase } from '@/lib/supabase'
import {
  AnalyticsDashboardData,
  AnalyticsFetchError,
  AnalyticsFetchParams,
  type AnalyticsFetchErrorCode,
} from './types'

async function readErrorBody(error: unknown): Promise<{
  error?: string
  code?: string
  missing?: string[]
} | null> {
  const ctx = (error as { context?: Response })?.context
  if (!ctx || typeof ctx.json !== 'function') return null
  try {
    return await ctx.clone().json()
  } catch {
    return null
  }
}

function throwFromBody(
  body: { error?: string; code?: string; missing?: string[] } | null,
  fallbackMessage: string,
): never {
  if (body?.code === 'GA4_NOT_CONFIGURED') {
    throw new AnalyticsFetchError(
      'חיבור GA4 עדיין לא הוגדר בשרת',
      'GA4_NOT_CONFIGURED',
      body.missing,
    )
  }
  throw new AnalyticsFetchError(
    body?.error || fallbackMessage,
    (body?.code as AnalyticsFetchErrorCode) || 'UNKNOWN',
    body?.missing,
  )
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
    throwFromBody(
      data as { error?: string; code?: string; missing?: string[] },
      'שגיאה בטעינת אנליטיקות',
    )
  }

  if (!data || typeof data !== 'object' || !('overview' in data)) {
    throw new AnalyticsFetchError('תשובה לא תקינה מהשרת', 'UNKNOWN')
  }

  const payload = data as AnalyticsDashboardData

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
  }

  return payload
}
