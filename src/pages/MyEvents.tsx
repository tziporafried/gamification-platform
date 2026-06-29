import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, ExternalLink, Trash2, Share2, Settings2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { ShareEventModal } from '@/components/ShareEventModal'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import type { Event } from '@/types'
import { getWizardPrefs } from '@/lib/wizard'

export function MyEvents() {
  const { user, isFreePlan } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null)
  const [sharingEvent, setSharingEvent] = useState<Event | null>(null)
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
    setCreating(true)
    const slug = `event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const { data, error: insertError } = await supabase
      .from('events')
      .insert({
        owner_admin_id: user!.id,
        name: '',
        slug,
        status: 'editing',
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
        <div className="space-y-4">
          <h1 className="text-lg font-bold text-white">האירועים שלי</h1>

          {error && <ErrorAlert message={error} />}
          {successMsg && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {successMsg}
            </div>
          )}

          <div className="space-y-2">
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                isOwner={event.owner_admin_id === user!.id}
                isFreePlan={isFreePlan}
                onDelete={() => setDeletingEvent(event)}
                onShare={() => setSharingEvent(event)}
              />
            ))}
          </div>

          <button
            onClick={handleCreateEvent}
            disabled={creating}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-game-border py-3 text-sm text-gray-500 hover:border-brand-500/50 hover:text-brand-400 transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            {creating ? 'יוצר...' : 'צור אירוע חדש'}
          </button>
        </div>
      )}

      <ShareEventModal
        isOpen={!!sharingEvent}
        onClose={() => setSharingEvent(null)}
        eventId={sharingEvent?.id ?? ''}
      />

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

interface EventRowProps {
  event: Event
  isOwner: boolean
  isFreePlan: boolean
  onDelete: () => void
  onShare: () => void
}

function EventRow({ event, isOwner, isFreePlan, onDelete, onShare }: EventRowProps) {
  const navigate = useNavigate()

  const statusLabels: Record<string, { label: string; color: string }> = {
    editing: { label: 'בעריכה', color: '#f59e0b' },
    active: { label: 'פעיל', color: '#34d399' },
    archived: { label: 'בארכיון', color: 'text-red-400 bg-red-400/10' },
  }

  const status = statusLabels[event.status] || statusLabels.editing

  function handleOpenControl(e: React.MouseEvent) {
    e.stopPropagation()
    navigate(`/events/${event.id}/control`)
  }

  function handleOpenSettings(e: React.MouseEvent) {
    e.stopPropagation()
    const lastStep = getWizardPrefs(event.id).lastStep
    navigate(`/events/${event.id}/step/${lastStep}`)
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    onDelete()
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    onShare()
  }

  const isWip = event.status === 'editing'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => isWip ? navigate(`/events/${event.id}/step/${getWizardPrefs(event.id).lastStep}`) : navigate(`/events/${event.id}/control`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isWip ? navigate(`/events/${event.id}/step/${getWizardPrefs(event.id).lastStep}`) : navigate(`/events/${event.id}/control`) } }}
      className="group relative flex w-full cursor-pointer items-center gap-5 px-5 py-4 text-right bg-game-dark hover:bg-white/[0.03] transition-colors rounded-2xl border border-game-border overflow-hidden"
    >
      {/* Brand color left accent bar */}
      <div className="absolute right-0 top-0 h-full w-1 rounded-r-none transition-opacity opacity-60 group-hover:opacity-100 bg-brand-600" />

      {/* Logo / icon */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 border border-brand-600/25">
        {event.logo_url ? (
          <img src={event.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <Calendar size={22} className="text-brand-400" />
        )}
      </div>

      {/* Name + date */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-base font-bold text-white truncate leading-snug">
            {event.name || 'אירוע ללא שם'}
          </p>
          {isFreePlan && <Badge label="משחק התנסות" color="#a78bfa" />}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          נוצר {new Date(event.created_at).toLocaleDateString('he-IL')}
        </p>
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        <Badge label={status.label} color={status.color} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
        <button
          onClick={handleOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all"
          title="הגדרות"
        >
          <Settings2 size={13} />
          הגדרות
        </button>
        <button
          onClick={handleOpenControl}
          disabled={isWip}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 hover:bg-white/10 hover:text-white"
          title={isWip ? 'האירוע עדיין בעריכה' : 'להתחיל לשחק'}
        >
          <ExternalLink size={13} />
          להתחיל לשחק
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all"
        >
          <Share2 size={13} />
          שיתוף
        </button>
        {isOwner && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={13} />
            מחיקה
          </button>
        )}
      </div>
    </div>
  )
}
