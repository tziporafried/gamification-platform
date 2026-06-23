import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { LeaderboardSection } from '@/components/leaderboard/LeaderboardSection'
import { useEventHeaderBreadcrumb } from '@/hooks/useEventHeaderBreadcrumb'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import type { Event } from '@/types'

export function EventDisplayPage() {
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

  return (
    <EventDisplayContent event={event} />
  )
}

function EventDisplayContent({ event }: { event: Event }) {
  useEventHeaderBreadcrumb(event.name, 'תצוגה')

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <LeaderboardSection eventId={event.id} themeColor={event.theme_color} />
    </main>
  )
}
