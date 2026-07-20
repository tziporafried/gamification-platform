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
  newUsers: number
  videoView: number
  videoComplete: number
  viewPlans: number
  selectPlan: number
  contactFormOpen: number
  generateLead: number
  ctaClick: number
  faqOpen: number
  loginView: number
  signUp: number
  eventCreated: number
}

export interface AnalyticsUtmSourceRow {
  source: string
  users: number
}

export interface AnalyticsUtmMediumRow {
  medium: string
  users: number
}

export interface AnalyticsUtmCampaignRow {
  campaign: string
  users: number
}

export interface AnalyticsUtmContentRow {
  content: string
  users: number
}

export interface AnalyticsLinkPerformanceRow {
  content: string
  source: string | null
  users: number
  newUsers: number
  videoViewUsers: number
  plansViewUsers: number
  leadUsers: number
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
    /** Always site-wide - not scoped by affiliate filter. */
    videoUsers: number
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
    emailClickUsers: number
    phoneClickUsers: number
    bySource: AnalyticsNamedMetric[] | null
    bySourceUnavailable: boolean
    opensBySource: AnalyticsNamedMetric[] | null
    opensBySourceUnavailable: boolean
  }
  timeSeries: {
    days: AnalyticsTimeSeriesDay[]
    unavailable: boolean
    /** hour when startDate === endDate (today or any single custom day); otherwise day */
    granularity?: 'day' | 'hour'
  }
  trafficSources: {
    items: AnalyticsNamedMetric[] | null
    totalUsers: number
    unavailable: boolean
  }
  utm: {
    taggedVisitors: number
    sourceBreakdown: AnalyticsUtmSourceRow[] | null
    mediumBreakdown: AnalyticsUtmMediumRow[] | null
    campaignBreakdown: AnalyticsUtmCampaignRow[] | null
    contentBreakdown: AnalyticsUtmContentRow[] | null
    linkPerformance: AnalyticsLinkPerformanceRow[] | null
    unavailable: boolean
    unavailableParams: string[]
  }
  meta: {
    startDate: string
    endDate: string
    timeSeriesWarnings?: string[]
  }
}

export interface AnalyticsFetchParams {
  preset: AnalyticsDatePreset
  startDate?: string
  endDate?: string
  /** Affiliate content codes for the trend series. [] = whole site (no filter). */
  utmContents?: string[]
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
