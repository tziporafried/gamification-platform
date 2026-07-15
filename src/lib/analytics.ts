const MEASUREMENT_ID =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || 'G-R9RCTZ6BK5'

const LANDING_REFERRER_KEY = 'gamify_landing_referrer'
const PENDING_AUTH_METHOD_KEY = 'gamify_pending_auth_method'
const UTM_ATTRIBUTION_KEY = 'gamify_utm_attribution'

/** Dedupe window to absorb React StrictMode double-effects / rapid remounts. */
const DEDUPE_WINDOW_MS = 800
const recentEventKeys = new Map<string, number>()

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

import {
  normalizeUtmAttribution,
  readUtmFromSearch,
  utmAttributionToParams,
  type UtmAttribution,
} from '@/lib/utmAttribution'

type AnalyticsParams = Record<string, string | number | boolean | undefined>

export type { UtmAttribution }

function isEnabled() {
  return Boolean(MEASUREMENT_ID && typeof window !== 'undefined')
}

function shouldSkipDedupe(key: string): boolean {
  const now = Date.now()
  const last = recentEventKeys.get(key) ?? 0
  if (now - last < DEDUPE_WINDOW_MS) return true
  recentEventKeys.set(key, now)
  return false
}

/** Capture external referrer once per session (which site brought the visitor). */
export function captureLandingReferrer() {
  if (typeof window === 'undefined') return
  try {
    if (!sessionStorage.getItem(LANDING_REFERRER_KEY)) {
      sessionStorage.setItem(LANDING_REFERRER_KEY, document.referrer || '(direct)')
    }
  } catch {
    /* private mode / blocked storage */
  }
}

export function getLandingReferrer(): string {
  try {
    return sessionStorage.getItem(LANDING_REFERRER_KEY) || document.referrer || '(direct)'
  } catch {
    return document.referrer || '(direct)'
  }
}

/**
 * Persist first-touch-style UTM attribution for the browser session.
 * - Captures when at least one UTM param is present in the URL
 * - Updates when the visitor enters via a new tagged URL
 * - Does not clear on SPA navigations that omit UTMs
 */
export function captureUtmAttribution(search = typeof window !== 'undefined' ? window.location.search : '') {
  if (typeof window === 'undefined') return
  const fromUrl = readUtmFromSearch(search)
  if (!fromUrl) return
  try {
    sessionStorage.setItem(UTM_ATTRIBUTION_KEY, JSON.stringify(fromUrl))
  } catch {
    /* private mode / blocked storage */
  }
}

export function getUtmAttribution(): UtmAttribution {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(UTM_ATTRIBUTION_KEY)
    if (!raw) return {}
    return normalizeUtmAttribution(JSON.parse(raw))
  } catch {
    return {}
  }
}

/**
 * Restore first-touch attribution into session storage when the URL/session
 * has none — e.g. returning logged-in user so homepage keeps affiliate UTMs.
 * Does not overwrite an attribution already captured this session.
 */
export function restoreUtmAttribution(raw: unknown): UtmAttribution {
  if (typeof window === 'undefined') return {}
  const fromProfile = normalizeUtmAttribution(raw)
  if (!Object.keys(fromProfile).length) return getUtmAttribution()
  const existing = getUtmAttribution()
  if (Object.keys(existing).length) return existing
  try {
    sessionStorage.setItem(UTM_ATTRIBUTION_KEY, JSON.stringify(fromProfile))
  } catch {
    /* private mode / blocked storage */
  }
  return fromProfile
}

function getUtmAttributionParams(): AnalyticsParams {
  return utmAttributionToParams(getUtmAttribution())
}

export function initAnalytics() {
  if (!isEnabled() || typeof window === 'undefined') return

  captureLandingReferrer()
  captureUtmAttribution()

  // gtag may already be loaded from index.html
  if (window.gtag) return

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }

  window.gtag('js', new Date())
  window.gtag('config', MEASUREMENT_ID!, {
    send_page_view: false,
    anonymize_ip: true,
  })
}

/** Track SPA route as a page view, including landing referrer + UTM attribution. */
export function trackPageView(path: string) {
  if (!isEnabled() || !window.gtag) return
  captureUtmAttribution()
  if (shouldSkipDedupe(`page_view:${path}`)) return

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: document.title,
    page_location: window.location.href,
    page_referrer: document.referrer || undefined,
    landing_referrer: getLandingReferrer(),
    ...getUtmAttributionParams(),
  })
}

/** Generic GA4 event helper — attaches persisted UTM attribution when present. */
export function trackEvent(eventName: string, params?: AnalyticsParams) {
  if (!isEnabled() || !window.gtag) return
  window.gtag('event', eventName, {
    ...getUtmAttributionParams(),
    ...params,
  })
}

function trackEventDeduped(dedupeKey: string, eventName: string, params?: AnalyticsParams) {
  if (shouldSkipDedupe(dedupeKey)) return
  trackEvent(eventName, params)
}

// ─── Marketing / video ───────────────────────────────────────────────────────

export function trackCtaClick(params: {
  cta_name: string
  cta_location: string
  destination: string
  contact_source?: string
}) {
  trackEvent('cta_click', params)
}

/** Contact modal opened (homepage / trial / pricing custom solution). */
export function trackContactFormOpen(params: {
  contact_source: string
  cta_location: string
}) {
  trackEvent('contact_form_open', {
    contact_source: params.contact_source,
    cta_location: params.cta_location,
  })
}

export function trackVideoView(videoId = 'gamify-tour') {
  trackEvent('video_view', {
    video_id: videoId,
    video_title: 'Gamify tour',
  })
}

export function trackVideoComplete(videoId = 'gamify-tour') {
  trackEvent('video_complete', {
    video_id: videoId,
    video_title: 'Gamify tour',
  })
}

export function trackVideoProgress(
  progressPercent: 25 | 50 | 75,
  videoId = 'gamify-tour',
) {
  trackEvent('video_progress', {
    video_id: videoId,
    video_title: 'Gamify tour',
    progress_percent: progressPercent,
  })
}

// ─── Pricing / plans ─────────────────────────────────────────────────────────

/** User opened the plans / activation modal. (Covers requested view_pricing.) */
export function trackViewPlans(hasLinkedEvent = false) {
  trackEventDeduped(`view_plans:${hasLinkedEvent ? 'linked' : 'none'}`, 'view_plans', {
    page_path: 'plans_modal',
    has_linked_event: hasLinkedEvent,
  })
}

/**
 * User chose a plan option and opened the contact form.
 * Replaces the former `contact_click` event name (same trigger) to align with GA naming.
 */
export function trackSelectPlan(planName: string, hasLinkedEvent = false) {
  trackEvent('select_plan', {
    plan_name: planName,
    has_linked_event: hasLinkedEvent,
  })
}

/** @deprecated Alias — fires `select_plan` (replaces legacy `contact_click` name). */
export function trackContactClick(planOption: string, eventId?: string | null) {
  trackSelectPlan(planOption, Boolean(eventId))
}

/** Successful contact / upgrade request submit (no PII). */
export function trackGenerateLead(
  planName: string,
  hasLinkedEvent = false,
  contactSource?: string,
) {
  trackEvent('generate_lead', {
    plan_name: planName,
    has_linked_event: hasLinkedEvent,
    ...(contactSource ? { contact_source: contactSource } : {}),
  })
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export function trackLoginView() {
  trackEventDeduped('login_view', 'login_view')
}

export function trackLoginStart(method: 'email' | 'google') {
  trackEvent('login_start', { method })
}

/** GA4 recommended event — successful login. */
export function trackLogin(method: 'email' | 'google') {
  trackEvent('login', { method })
}

/** GA4 recommended event — successful sign-up / account creation. */
export function trackSignUp(method: 'email' | 'google') {
  trackEvent('sign_up', { method })
}

export function trackLoginError(
  errorType: 'validation' | 'network' | 'credentials' | 'oauth',
  method?: 'email' | 'google',
) {
  trackEvent('login_error', {
    error_type: errorType,
    ...(method ? { method } : {}),
  })
}

export function markPendingAuthMethod(method: 'google') {
  try {
    sessionStorage.setItem(PENDING_AUTH_METHOD_KEY, method)
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * If the user just returned from OAuth, fire login/sign_up once and clear the flag.
 * New accounts (created in the last 2 minutes) count as sign_up.
 */
export function consumePendingOAuthAuth(userCreatedAt: string | undefined) {
  let method: string | null = null
  try {
    method = sessionStorage.getItem(PENDING_AUTH_METHOD_KEY)
    if (method) sessionStorage.removeItem(PENDING_AUTH_METHOD_KEY)
  } catch {
    return
  }
  if (method !== 'google') return

  const createdMs = userCreatedAt ? new Date(userCreatedAt).getTime() : NaN
  const isNew = Number.isFinite(createdMs) && Date.now() - createdMs < 120_000
  if (isNew) trackSignUp('google')
  else trackLogin('google')
}

// ─── Event creation / wizard ─────────────────────────────────────────────────

export function trackEventCreationStart() {
  trackEvent('event_creation_start')
}

export function trackEventCreated(creationMethod: 'scratch' | 'new' = 'new') {
  trackEvent('event_created', { creation_method: creationMethod })
}

/** User chose how to start building the event (after the event row already exists). */
export function trackEventStartMethod(method: 'scratch' | 'template') {
  trackEvent('event_start_method', { method })
}

export function trackFaqOpen(question: string, questionIndex: number) {
  trackEvent('faq_open', {
    question,
    question_index: questionIndex,
  })
}

/** Homepage FAQ: user expanded the full question list. */
export function trackFaqShowAll() {
  trackEvent('faq_show_all')
}

/** Landing section entered viewport (once per session key / remount window). */
export function trackHowItWorksView() {
  trackEventDeduped('how_it_works_view', 'how_it_works_view')
}

export function trackWizardStepView(stepNumber: number, stepName: string) {
  trackEventDeduped(`wizard_step_view:${stepNumber}`, 'wizard_step_view', {
    step_number: stepNumber,
    step_name: stepName,
  })
}

export function trackWizardStepComplete(stepNumber: number, stepName: string) {
  trackEvent('wizard_step_complete', {
    step_number: stepNumber,
    step_name: stepName,
  })
}

export function trackWizardBack(fromStep: number, toStep: number) {
  trackEvent('wizard_back', {
    from_step: fromStep,
    to_step: toStep,
  })
}

export function trackWizardExit(stepNumber: number, stepName: string) {
  trackEvent('wizard_exit', {
    step_number: stepNumber,
    step_name: stepName,
  })
}

// ─── Event management ────────────────────────────────────────────────────────

export function trackEventOpen(destination: 'control' | 'wizard') {
  trackEvent('event_open', { destination })
}

export function trackEventEditStart(wasActive: boolean) {
  trackEvent('event_edit_start', { was_active: wasActive })
}

export function trackEventUpdated() {
  trackEvent('event_updated')
}

export function trackEventDeleted() {
  trackEvent('event_deleted')
}

// ─── Scanning / leaderboard ──────────────────────────────────────────────────

export function trackScannerView(plan?: string) {
  trackEventDeduped(`scanner_view:${plan ?? 'unknown'}`, 'scanner_view', {
    ...(plan ? { plan } : {}),
  })
}

export function trackScanSuccess(source: 'qr_scan' | 'manual_entry') {
  trackEvent('scan_success', { source })
}

export function trackScanFailed(
  errorType: 'not_started' | 'invalid_qr' | 'submit_failed' | 'trial_scan_limit',
  source?: 'qr_scan' | 'manual_entry',
) {
  trackEvent('scan_failed', {
    error_type: errorType,
    ...(source ? { source } : {}),
  })
}

/** Successful trial-mode scan (event still on free / trial plan). */
export function trackTrialScanCompleted(eventId: string, scanNumber: number) {
  trackEvent('trial_scan_completed', {
    event_id: eventId,
    scan_number: scanNumber,
  })
}

/** User attempted a scan after exhausting the trial quota. */
export function trackTrialScanLimitReached(eventId: string, allowedScans: number) {
  trackEvent('trial_scan_limit_reached', {
    event_id: eventId,
    allowed_scans: allowedScans,
  })
}

/** User clicked a CTA that opens activation options. */
export function trackActivationOptionsClicked(
  eventId: string,
  source: 'events_page_trial_badge' | 'wizard_trial_badge',
) {
  trackEvent('activation_options_clicked', {
    event_id: eventId,
    source,
  })
}

export type ActivationOptionsSource =
  | 'trial_scan_limit'
  | 'game_home_trial'
  | 'events_page_trial_badge'
  | 'wizard_trial_badge'
  | 'plan_limit_modal'
  | 'header'
  | 'post_wizard'
  | 'deep_link'

/** User opened activation options (plans modal) from a tracked entry point. */
export function trackActivationOptionsViewed(eventId: string, source: ActivationOptionsSource) {
  trackEvent('activation_options_viewed', {
    event_id: eventId,
    source,
  })
}

/** Trial event successfully moved to a real activation mode. */
export function trackTrialActivated(
  eventId: string,
  activationMode: string,
  trialScansUsed: number,
) {
  trackEvent('trial_activated', {
    event_id: eventId,
    activation_mode: activationMode,
    trial_scans_used: trialScansUsed,
  })
}

/** Trial runtime activity data wiped after activation. */
export function trackTrialDataReset(eventId: string) {
  trackEvent('trial_data_reset', {
    event_id: eventId,
  })
}

/** Prize celebration after a successful scan — no user-authored prize text. */
export function trackPrizeRevealed(prizeCount: number) {
  trackEvent('prize_revealed', {
    prize_type: 'milestone',
    prize_count: prizeCount,
  })
}

export function trackLeaderboardView() {
  trackEventDeduped('leaderboard_view', 'leaderboard_view')
}

// ─── Errors (sparse — not an error monitoring system) ────────────────────────

export function trackAppError(
  errorArea: 'auth' | 'event_creation' | 'scanner' | 'pricing',
  errorType: string,
) {
  trackEventDeduped(`app_error:${errorArea}:${errorType}`, 'app_error', {
    error_area: errorArea,
    error_type: errorType,
  })
}
