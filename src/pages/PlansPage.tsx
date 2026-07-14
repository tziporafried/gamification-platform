import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usePlansModal, type PlansOption } from '@/contexts/PlansModalContext'

/**
 * Deep-link / post-login entry for activation options.
 * Opens the plans modal on top of events (or home) instead of rendering a dedicated page.
 */
export function PlansPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const { openPlans } = usePlansModal()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const planParam = searchParams.get('plan')
    const plan: PlansOption | null =
      planParam === 'independent' || planParam === 'full' || planParam === 'organizations'
        ? planParam
        : null

    openPlans({
      eventId: searchParams.get('event'),
      source: searchParams.get('source'),
      plan,
    })

    navigate(user ? '/events' : '/', { replace: true })
  }, [navigate, openPlans, searchParams, user])

  return null
}
