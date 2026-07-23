import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { WinnersCeremony } from '@/components/leaderboard/WinnersCeremony'
import { FloatingIconsLayer } from '@/components/layout/FloatingIconsLayer'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { ScreenControls } from '@/components/ui/ScreenControls'
import { trackLeaderboardView } from '@/lib/analytics'
import type { Event } from '@/types'

export function EventDisplayPage() {
  const { id } = useParams<{ id: string }>()
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
  }, [id, navigate])

  useEffect(() => {
    if (!event) return
    trackLeaderboardView()
  }, [event])

  if (loading || !event) return <FullPageLoader />

  return (
    <div className="relative min-h-screen bg-app-radial">
      <ScreenControls to={`/events/${event.id}/control`} />
      <FloatingIconsLayer />
      <WinnersCeremony
        eventId={event.id}
        eventName={event.name}
        eventLogoUrl={event.logo_url}
      />
    </div>
  )
}
