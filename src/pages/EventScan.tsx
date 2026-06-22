import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ScoreEntry } from '@/components/scoring/ScoreEntry'
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

  if (loading || !event) {
    return (
      <div className="flex h-screen items-center justify-center bg-game-dark">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-game-dark">
      <header className="border-b border-game-border bg-game-dark/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <button
            onClick={() => navigate(`/events/${event.id}/control`)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ArrowRight size={16} />
            <span>חזרה למרכז הבקרה</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">
        <ScoreEntry eventId={event.id} qrScoringMode={event.qr_scoring_mode} />
      </main>
    </div>
  )
}
