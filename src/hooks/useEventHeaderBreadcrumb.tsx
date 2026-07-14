import { useEffect } from 'react'
import { EventHeaderBreadcrumb } from '@/components/layout/EventHeaderBreadcrumb'
import { useHeaderSlot } from '@/contexts/HeaderSlotContext'
import { useAuth } from '@/contexts/AuthContext'
import type { UserPlan } from '@/types'

interface EventHeaderBreadcrumbOptions {
  /** Show My Events-style trial activation pill after the event name (wizard). */
  showTrialBadge?: boolean
}

export function useEventHeaderBreadcrumb(
  eventName: string,
  suffix?: string,
  plan?: UserPlan,
  eventId?: string,
  options?: EventHeaderBreadcrumbOptions,
) {
  const { setCenterSlot, setCurrentPlan, setCurrentEventId, setSuppressHeaderActivationCta } =
    useHeaderSlot()
  const { isSuperAdmin } = useAuth()
  const showTrialBadge =
    !!options?.showTrialBadge && !!eventId && plan === 'free' && !isSuperAdmin

  useEffect(() => {
    setCenterSlot(
      <EventHeaderBreadcrumb
        eventName={eventName}
        suffix={suffix}
        trialEventId={showTrialBadge ? eventId : undefined}
      />,
    )
    return () => setCenterSlot(null)
  }, [eventName, suffix, eventId, showTrialBadge, setCenterSlot])

  useEffect(() => {
    setCurrentPlan(plan ?? null)
    return () => setCurrentPlan(null)
  }, [plan, setCurrentPlan])

  useEffect(() => {
    setCurrentEventId(eventId ?? null)
    return () => setCurrentEventId(null)
  }, [eventId, setCurrentEventId])

  useEffect(() => {
    setSuppressHeaderActivationCta(showTrialBadge)
    return () => setSuppressHeaderActivationCta(false)
  }, [showTrialBadge, setSuppressHeaderActivationCta])
}
