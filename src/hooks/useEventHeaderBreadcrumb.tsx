import { useEffect } from 'react'
import { EventHeaderBreadcrumb } from '@/components/layout/EventHeaderBreadcrumb'
import { useHeaderSlot } from '@/contexts/HeaderSlotContext'
import { useAuth } from '@/contexts/AuthContext'
import type { UserPlan } from '@/types'

interface EventHeaderBreadcrumbOptions {
  /** Show My Events-style trial activation pill after the event name (wizard). */
  showTrialBadge?: boolean
  /** When false, do not touch the global header (e.g. wizard embedded in a modal). */
  enabled?: boolean
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
  const enabled = options?.enabled !== false
  const showTrialBadge =
    enabled && !!options?.showTrialBadge && !!eventId && plan === 'free' && !isSuperAdmin

  useEffect(() => {
    if (!enabled) return
    setCenterSlot(
      <EventHeaderBreadcrumb
        eventName={eventName}
        suffix={suffix}
        trialEventId={showTrialBadge ? eventId : undefined}
      />,
    )
    return () => setCenterSlot(null)
  }, [enabled, eventName, suffix, eventId, showTrialBadge, setCenterSlot])

  useEffect(() => {
    if (!enabled) return
    setCurrentPlan(plan ?? null)
    return () => setCurrentPlan(null)
  }, [enabled, plan, setCurrentPlan])

  useEffect(() => {
    if (!enabled) return
    setCurrentEventId(eventId ?? null)
    return () => setCurrentEventId(null)
  }, [enabled, eventId, setCurrentEventId])

  useEffect(() => {
    if (!enabled) return
    setSuppressHeaderActivationCta(showTrialBadge)
    return () => setSuppressHeaderActivationCta(false)
  }, [enabled, showTrialBadge, setSuppressHeaderActivationCta])
}
