import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ScoreEntry } from '@/components/scoring/ScoreEntry'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import type { Event } from '@/types'

export function EventScanPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

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
  }, [id, user, navigate])

  if (loading || !event) return <FullPageLoader />

  return <EventScanContent event={event} />
}

function EventScanContent({ event }: { event: Event }) {
  return (
    <ScoreEntry
      eventId={event.id}
      qrScoringMode={event.qr_scoring_mode}
      eventName={event.name}
      eventLogoUrl={event.logo_url}
    />
  )
}
