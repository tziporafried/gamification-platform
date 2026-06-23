import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { LeaderboardSection } from '@/components/leaderboard/LeaderboardSection'
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
    <div className="relative min-h-screen bg-game-dark">
      <div className="absolute left-4 top-3 z-30">
        <button
          onClick={() => navigate(`/events/${event.id}/control`)}
          className="flex items-center gap-1.5 rounded-lg bg-game-card/60 px-3 py-1.5 text-sm text-gray-400 backdrop-blur-sm transition-colors hover:bg-game-card hover:text-gray-200"
        >
          <ArrowRight size={14} />
          <span>חזרה</span>
        </button>
      </div>
      <LeaderboardSection
        eventId={event.id}
        themeColor={event.theme_color}
        eventName={event.name}
        eventLogoUrl={event.logo_url}
      />
    </div>
  )
}
