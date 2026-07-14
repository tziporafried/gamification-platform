import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  initAnalytics,
  trackPageView,
  trackWizardExit,
} from '@/lib/analytics'
import { WIZARD_STEPS } from '@/types'

const WIZARD_STEP_RE = /^\/events\/[^/]+\/step\/(\d+)/

function stepNameFor(stepNumber: number): string {
  return WIZARD_STEPS.find((s) => s.step === stepNumber)?.id ?? `step_${stepNumber}`
}

/** Loads GA4 (when configured) and sends a page_view on every route change. */
export function AnalyticsListener() {
  const location = useLocation()
  const prevPathRef = useRef(location.pathname)

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
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
  }, [location.pathname, location.search])

  return null
}
