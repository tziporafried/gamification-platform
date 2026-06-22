import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, LogOut, Shield, ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Event } from '@/types'

export function MyEvents() {
  const { user, signOut, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEvents() {
      const [owned, shared] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .eq('owner_admin_id', user!.id),
        supabase
          .from('event_collaborators')
          .select('event_id')
          .eq('user_id', user!.id)
          .then(async ({ data: collabs }) => {
            if (!collabs?.length) return { data: [] as Event[] }
            return supabase
              .from('events')
              .select('*')
              .in('id', collabs.map(c => c.event_id))
          }),
      ])

      const all = [...(owned.data || []), ...(shared.data || [])]
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setEvents(all)
      setLoading(false)
    }
    fetchEvents()
  }, [user])

  async function handleCreateEvent() {
    const { data } = await supabase
      .from('events')
      .insert({
        owner_admin_id: user!.id,
        name: '',
        slug: `event-${Date.now()}`,
        theme_color: '#7c3aed',
        status: 'draft',
        qr_scoring_mode: 'separate',
      })
      .select()
      .single()

    if (data) {
      navigate(`/events/${data.id}/step/1`)
    }
  }

  const userEmail = user?.email || ''
  const userName = userEmail.split('@')[0] || 'משתמש'

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-game-dark">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-game-dark">
      {/* Header */}
      <header className="border-b border-game-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <h1 className="text-lg font-bold text-white">האירועים שלי</h1>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Shield size={16} />
                <span className="hidden sm:inline">ניהול</span>
              </button>
            )}
            <span className="text-sm text-gray-400 hidden sm:inline">{userName}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {events.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600/20 mb-6">
              <Calendar size={32} className="text-brand-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">אין לך אירועים עדיין</h2>
            <p className="text-gray-400 mb-8 max-w-sm">
              צור את האירוע הראשון שלך – חופשה משפחתית, מחנה קיץ, או כל פעילות קבוצתית
            </p>
            <Button variant="gradient" size="lg" onClick={handleCreateEvent}>
              <Plus size={20} className="ml-2" />
              יצירת אירוע חדש
            </Button>
          </div>
        ) : (
          /* Event list */
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>

            <div className="flex justify-center pt-4">
              <Button variant="outline" size="lg" onClick={handleCreateEvent}>
                <Plus size={18} className="ml-2" />
                אירוע חדש
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function EventCard({ event }: { event: Event }) {
  const navigate = useNavigate()

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'טיוטה', color: 'text-gray-400 bg-gray-400/10' },
    active: { label: 'פעיל', color: 'text-emerald-400 bg-emerald-400/10' },
    finished: { label: 'הסתיים', color: 'text-amber-400 bg-amber-400/10' },
    archived: { label: 'ארכיון', color: 'text-gray-500 bg-gray-500/10' },
  }

  const status = statusLabels[event.status] || statusLabels.draft

  function handleOpenControl(e: React.MouseEvent) {
    e.stopPropagation()
    if (!event.slug) {
      console.warn('Event is missing slug, cannot open control center:', event.id)
      return
    }
    navigate(`/e/${event.slug}/control`)
  }


  return (
    <button
      onClick={() => navigate(`/events/${event.id}`)}
      className="text-right w-full"
    >
      <Card variant="interactive" className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/20">
            {event.logo_url ? (
              <img src={event.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <Calendar size={20} className="text-brand-400" />
            )}
          </div>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', status.color)}>
            {status.label}
          </span>
        </div>

        <div>
          <h3 className="font-bold text-white truncate">
            {event.name || 'אירוע ללא שם'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(event.created_at).toLocaleDateString('he-IL')}
          </p>
        </div>

        {event.slug && (
          <div className="flex items-center gap-3 pt-1 border-t border-game-border">
            <button
              onClick={handleOpenControl}
              className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              <ExternalLink size={12} />
              פתח מרכז בקרה
            </button>
          </div>
        )}
      </Card>
    </button>
  )
}
