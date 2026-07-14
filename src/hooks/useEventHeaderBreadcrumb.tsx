import { useEffect } from 'react'
import { EventHeaderBreadcrumb } from '@/components/layout/EventHeaderBreadcrumb'
import { useHeaderSlot } from '@/contexts/HeaderSlotContext'
import type { UserPlan } from '@/types'

export function useEventHeaderBreadcrumb(eventName: string, suffix?: string, plan?: UserPlan, eventId?: string) {
  const { setCenterSlot, setCurrentPlan, setCurrentEventId } = useHeaderSlot()

  useEffect(() => {
    setCenterSlot(<EventHeaderBreadcrumb eventName={eventName} suffix={suffix} />)
    return () => setCenterSlot(null)
  }, [eventName, suffix, setCenterSlot])

  useEffect(() => {
    setCurrentPlan(plan ?? null)
    return () => setCurrentPlan(null)
  }, [plan, setCurrentPlan])

  useEffect(() => {
    setCurrentEventId(eventId ?? null)
    return () => setCurrentEventId(null)
  }, [eventId, setCurrentEventId])
}
