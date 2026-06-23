import { useEffect } from 'react'
import { EventHeaderBreadcrumb } from '@/components/layout/EventHeaderBreadcrumb'
import { useHeaderSlot } from '@/contexts/HeaderSlotContext'

export function useEventHeaderBreadcrumb(eventName: string, suffix?: string) {
  const { setCenterSlot } = useHeaderSlot()

  useEffect(() => {
    setCenterSlot(<EventHeaderBreadcrumb eventName={eventName} suffix={suffix} />)
    return () => setCenterSlot(null)
  }, [eventName, suffix, setCenterSlot])
}
