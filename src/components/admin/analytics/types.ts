export type AnalyticsDatePreset = 'today' | '7d' | '14d' | '28d' | 'custom'

export interface AnalyticsNamedMetric {
  label: string
  users: number
}

export interface AnalyticsCtaMatrixRow {
  name: string
  location: string
  users: number
}

export interface AnalyticsQuestionRow {
  question: string
  users: number
  opens: number
}

export interface AnalyticsTimeSeriesDay {
  date: string
  visitors: number
  videoView: number
  viewPlans: number
  generateLead: number
}

export interface AnalyticsDashboardData {
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
    questions: AnalyticsQuestionRow[] | null
    questionsUnavailable: boolean
  }
  ctas: {
    totalUsers: number
    byName: AnalyticsNamedMetric[] | null
    byLocation: AnalyticsNamedMetric[] | null
    byNameAndLocation: AnalyticsCtaMatrixRow[] | null
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
    byPlan: AnalyticsNamedMetric[] | null
    byPlanUnavailable: boolean
    activationBySource: AnalyticsNamedMetric[] | null
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
    bySource: AnalyticsNamedMetric[] | null
    bySourceUnavailable: boolean
    opensBySource: AnalyticsNamedMetric[] | null
    opensBySourceUnavailable: boolean
  }
  timeSeries: {
    days: AnalyticsTimeSeriesDay[]
    unavailable: boolean
  }
  trafficSources: {
    items: AnalyticsNamedMetric[] | null
    totalUsers: number
    unavailable: boolean
  }
  meta: {
    startDate: string
    endDate: string
  }
}

export interface AnalyticsFetchParams {
  preset: AnalyticsDatePreset
  startDate?: string
  endDate?: string
}

export type AnalyticsFetchErrorCode =
  | 'GA4_NOT_CONFIGURED'
  | 'GOOGLE_AUTH_FAILED'
  | 'GA4_CORE_FAILED'
  | 'GA4_HOMEPAGE_FAILED'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'UNKNOWN'

export class AnalyticsFetchError extends Error {
  code: AnalyticsFetchErrorCode
  missing?: string[]
  detail?: string

  constructor(
    message: string,
    code: AnalyticsFetchErrorCode,
    missing?: string[],
    detail?: string,
  ) {
    super(message)
    this.name = 'AnalyticsFetchError'
    this.code = code
    this.missing = missing
    this.detail = detail
  }
}

export type InsightSeverity = 'critical' | 'warning' | 'positive'

export interface AnalyticsInsight {
  id: string
  severity: InsightSeverity
  title: string
  detail: string
  counts: string
}
