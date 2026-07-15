import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  captureUtmAttribution,
  getUtmAttribution,
  initAnalytics,
  restoreUtmAttribution,
  trackPageView,
  trackWizardExit,
} from '@/lib/analytics'
import { searchNeedsUtmPersist, withPersistedUtmSearch } from '@/lib/utmAttribution'
import { WIZARD_STEPS } from '@/types'

const WIZARD_STEP_RE = /^\/events\/[^/]+\/step\/(\d+)/

/** OAuth callback owns its query string — don't inject UTMs mid-handshake. */
const SKIP_UTM_URL_PERSIST = /^\/auth\/callback\/?$/

function stepNameFor(stepNumber: number): string {
  return WIZARD_STEPS.find((s) => s.step === stepNumber)?.id ?? `step_${stepNumber}`
}

/** Loads GA4 (when configured) and sends a page_view on every route change. */
export function AnalyticsListener() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const prevPathRef = useRef(location.pathname)

  useEffect(() => {
    initAnalytics()
  }, [])

  // Returning users: restore first-touch affiliate from profile into session + URL (homepage etc).
  useEffect(() => {
    if (!profile?.affiliate_attribution) return
    restoreUtmAttribution(profile.affiliate_attribution)
    if (SKIP_UTM_URL_PERSIST.test(location.pathname)) return
    const utm = getUtmAttribution()
    if (searchNeedsUtmPersist(location.search, utm)) {
      navigate(
        {
          pathname: location.pathname,
          search: withPersistedUtmSearch(location.search, utm),
          hash: location.hash,
        },
        { replace: true },
      )
    }
  }, [profile?.affiliate_attribution, location.pathname, location.search, location.hash, navigate])

  useEffect(() => {
    // Keep affiliate UTMs visible in the address bar across SPA navigations.
    captureUtmAttribution(location.search)
    if (!SKIP_UTM_URL_PERSIST.test(location.pathname)) {
      const utm = getUtmAttribution()
      if (searchNeedsUtmPersist(location.search, utm)) {
        navigate(
          {
            pathname: location.pathname,
            search: withPersistedUtmSearch(location.search, utm),
            hash: location.hash,
          },
          { replace: true },
        )
        return
      }
    }

    const prevPath = prevPathRef.current
    const nextPath = location.pathname
    prevPathRef.current = nextPath

    const wizardMatch = prevPath.match(WIZARD_STEP_RE)
    if (wizardMatch) {
      const stillInWizard = WIZARD_STEP_RE.test(nextPath)
      const wentToControl = /^\/events\/[^/]+\/control$/.test(nextPath)
      // Leaving wizard without finishing (finish goes to control) counts as exit.
      if (!stillInWizard && !wentToControl) {
        const stepNumber = Number(wizardMatch[1])
        trackWizardExit(stepNumber, stepNameFor(stepNumber))
      }
    }

    const path = `${location.pathname}${location.search}`
    trackPageView(path)
  }, [location.pathname, location.search, location.hash, navigate])

  return null
}
