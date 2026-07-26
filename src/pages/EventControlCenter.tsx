import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useEventCounts } from '@/hooks/useEventCounts'
import { ControlCenter } from '@/components/wizard/ControlCenter'
import { EventFeaturesProvider } from '@/contexts/EventFeaturesContext'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { trackEventOpen } from '@/lib/analytics'
import type { Event, EventCounts } from '@/types'

const CONTROL_CENTER_COUNT_KEYS: (keyof EventCounts)[] = [
  'participants',
  'groups',
  'tasks',
  'transactions',
  'rewards',
]

export function EventControlCenterPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const countKeys = useMemo(() => CONTROL_CENTER_COUNT_KEYS, [])
  const { counts, loaded: countsLoaded } = useEventCounts(id, countKeys)

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .neq('status', 'archived')
        .single()

      if (!data) {
        navigate('/events', { replace: true })
        return
      }
      setEvent(data)
      setLoading(false)
    }
    fetchEvent()
  }, [id, navigate])

  useEffect(() => {
    if (!event) return
    trackEventOpen('control')
  }, [event])

  if (loading || !event || !countsLoaded) return <FullPageLoader />

  return (
    <EventFeaturesProvider eventId={event.id} plan={event.plan}>
      <ControlCenter event={event} counts={counts} />
    </EventFeaturesProvider>
  )
}
