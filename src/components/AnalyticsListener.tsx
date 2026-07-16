import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  captureUtmAttribution,
  getUtmAttribution,
  initAnalytics,
  markUtmUrlDisplayInject,
  restoreUtmAttribution,
  trackContactEmailClick,
  trackContactPhoneClick,
  trackPageView,
  trackWizardExit,
} from '@/lib/analytics'
import { searchNeedsUtmPersist, withPersistedUtmSearch } from '@/lib/utmAttribution'
import { WIZARD_STEPS } from '@/types'

const WIZARD_STEP_RE = /^\/events\/[^/]+\/step\/(\d+)/

/** OAuth callback owns its query string — don't inject UTMs mid-handshake. */
const SKIP_UTM_URL_PERSIST = /^\/auth\/callback\/?$/

const COMPANY_EMAIL = 'ourgamify@gmail.com'
const COMPANY_PHONE_DIGITS = '0556738544'

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function closestAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  return target.closest('a')
}

/** Detect company email / phone link clicks site-wide (mailto, tel, Gmail compose). */
function classifyContactChannelClick(anchor: HTMLAnchorElement): 'email' | 'phone' | null {
  const href = (anchor.getAttribute('href') ?? '').trim()
  if (!href) return null
  const lower = href.toLowerCase()

  if (lower.startsWith('mailto:')) {
    const address = lower.slice('mailto:'.length).split('?')[0]?.trim() ?? ''
    if (address.includes(COMPANY_EMAIL)) return 'email'
    return null
  }

  if (lower.includes('mail.google.com') && lower.includes(COMPANY_EMAIL)) {
    return 'email'
  }

  if (lower.startsWith('tel:')) {
    const phone = digitsOnly(lower.slice('tel:'.length))
    const company = digitsOnly(COMPANY_PHONE_DIGITS)
    if (phone && (phone === company || phone.endsWith(company) || company.endsWith(phone))) {
      return 'phone'
    }
    return null
  }

  return null
}

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

  // Capture company email / phone clicks anywhere (landing, forms, modals, etc.).
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      const anchor = closestAnchor(event.target)
      if (!anchor) return
      const channel = classifyContactChannelClick(anchor)
      if (channel === 'email') trackContactEmailClick()
      else if (channel === 'phone') trackContactPhoneClick()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // Returning users: restore first-touch affiliate from profile into session + URL (homepage etc).
  useEffect(() => {
    if (!profile?.affiliate_attribution) return
    restoreUtmAttribution(profile.affiliate_attribution)
    if (SKIP_UTM_URL_PERSIST.test(location.pathname)) return
    const utm = getUtmAttribution()
    if (searchNeedsUtmPersist(location.search, utm)) {
      const nextSearch = withPersistedUtmSearch(location.search, utm)
      markUtmUrlDisplayInject(nextSearch)
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch,
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
        const nextSearch = withPersistedUtmSearch(location.search, utm)
        markUtmUrlDisplayInject(nextSearch)
        navigate(
          {
            pathname: location.pathname,
            search: nextSearch,
            hash: location.hash,
          },
          { replace: true },
        )
        // Still track this view — do not wait for a second effect (short sessions).
        // page_path is pathname-only; dedupe absorbs the follow-up after replace.
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

    trackPageView(location.pathname)
  }, [location.pathname, location.search, location.hash, navigate])

  return null
}
