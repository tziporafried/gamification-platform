import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, ExternalLink, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { cn } from '@/lib/utils'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import type { Event } from '@/types'

export function MyEvents() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    async function fetchEvents() {
      const [owned, shared] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .eq('owner_admin_id', user!.id)
          .neq('status', 'archived'),
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
              .neq('status', 'archived')
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
    setError('')
    const existingDraft = events.find(e => e.status === 'editing' && !e.name && e.owner_admin_id === user!.id)
    if (existingDraft) {
      navigate(`/events/${existingDraft.id}/step/1`)
      return
    }

    setCreating(true)
    const slug = `event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const { data, error: insertError } = await supabase
      .from('events')
      .insert({
        owner_admin_id: user!.id,
        name: '',
        slug,
        theme_color: '#7c3aed',
        status: 'editing',
        qr_scoring_mode: 'separate',
      })
      .select()
      .single()

    setCreating(false)

    if (insertError) {
      setError(`שגיאה ביצירת אירוע: ${insertError.message}`)
      return
    }

    if (data) {
      navigate(`/events/${data.id}/step/1`)
    }
  }

  async function handleDeleteEvent() {
    if (!deletingEvent) return
    setDeleting(true)
    await supabase.from('events').update({ status: 'archived' }).eq('id', deletingEvent.id)
    setEvents(prev => prev.filter(e => e.id !== deletingEvent.id))
    setDeleting(false)
    setDeletingEvent(null)
    setSuccessMsg('האירוע נמחק בהצלחה.')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  if (loading) return <FullPageLoader />

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-600/20 mb-6">
            <Calendar size={40} className="text-brand-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">עדיין אין אירועים</h2>
          <p className="text-gray-400 mb-8 max-w-sm">
            צרו את האירוע הראשון שלכם והתחילו לנהל משתתפים, קבוצות ומשימות.
          </p>
          {error && <ErrorAlert message={error} className="mb-4 max-w-sm" />}
          <Button variant="gradient" size="lg" loading={creating} onClick={handleCreateEvent}>
            <Plus size={20} className="ml-2" />
            צור אירוע ראשון
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">האירועים שלי</h1>
            <Button variant="gradient" size="md" loading={creating} onClick={handleCreateEvent}>
              <Plus size={18} className="ml-1.5" />
              צור אירוע חדש
            </Button>
          </div>

          {error && <ErrorAlert message={error} />}
          {successMsg && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {successMsg}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isOwner={event.owner_admin_id === user!.id}
                onDelete={() => setDeletingEvent(event)}
              />
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!deletingEvent}
        onClose={() => setDeletingEvent(null)}
        title="מחיקת אירוע"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            האם את בטוחה שברצונך למחוק את האירוע{' '}
            <strong className="text-white">{deletingEvent?.name || 'ללא שם'}</strong>?
            {' '}האירוע יועבר לארכיון ולא יוצג במערכת.
          </p>
          <div className="flex gap-3">
            <Button variant="danger" loading={deleting} onClick={handleDeleteEvent}>
              מחק אירוע
            </Button>
            <Button variant="outline" onClick={() => setDeletingEvent(null)}>
              ביטול
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  )
}

interface EventCardProps {
  event: Event
  isOwner: boolean
  onDelete: () => void
}

function EventCard({ event, isOwner, onDelete }: EventCardProps) {
  const navigate = useNavigate()

  const statusLabels: Record<string, { label: string; color: string }> = {
    editing: { label: 'בעריכה', color: 'text-gray-400 bg-gray-400/10' },
    active: { label: 'פעיל', color: 'text-emerald-400 bg-emerald-400/10' },
    archived: { label: 'בארכיון', color: 'text-red-400 bg-red-400/10' },
  }

  const status = statusLabels[event.status] || statusLabels.editing

  function handleOpenControl(e: React.MouseEvent) {
    e.stopPropagation()
    if (!event.slug) return
    navigate(`/e/${event.slug}/control`)
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    onDelete()
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
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', status.color)}>
              {status.label}
            </span>
            {isOwner && (
              <button
                onClick={handleDelete}
                className="p-1 rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
                title="מחיקת אירוע"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
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
