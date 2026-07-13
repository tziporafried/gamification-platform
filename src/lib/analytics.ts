const MEASUREMENT_ID =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || 'G-R9RCTZ6BK5'

const LANDING_REFERRER_KEY = 'gamify_landing_referrer'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function isEnabled() {
  return Boolean(MEASUREMENT_ID && typeof window !== 'undefined')
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

export function initAnalytics() {
  if (!isEnabled() || typeof window === 'undefined') return

  captureLandingReferrer()

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

/** Track SPA route as a page view, including landing referrer. */
export function trackPageView(path: string) {
  if (!isEnabled() || !window.gtag) return

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: document.title,
    page_location: window.location.href,
    page_referrer: document.referrer || undefined,
    landing_referrer: getLandingReferrer(),
  })
}

/** Generic GA4 event helper. */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  if (!isEnabled() || !window.gtag) return
  window.gtag('event', eventName, params)
}

/** Count a home demo video view (call once when playback starts). */
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
