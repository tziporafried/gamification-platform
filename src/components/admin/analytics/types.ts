export type AnalyticsDatePreset = 'today' | '7d' | '14d' | '28d' | 'custom'

export interface AnalyticsNamedMetric {
  label: string
  users: number
}

export interface AnalyticsQuestionRow {
  question: string
  users: number
  opens: number
}

export interface AnalyticsDashboardData {
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
    questions: AnalyticsQuestionRow[] | null
    questionsUnavailable: boolean
  }
  ctas: {
    totalUsers: number
    byName: AnalyticsNamedMetric[] | null
    byLocation: AnalyticsNamedMetric[] | null
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

  constructor(message: string, code: AnalyticsFetchErrorCode, missing?: string[]) {
    super(message)
    this.name = 'AnalyticsFetchError'
    this.code = code
    this.missing = missing
  }
}
