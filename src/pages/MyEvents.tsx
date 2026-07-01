import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, ExternalLink, Trash2, Share2, Settings2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { SuccessAlert } from '@/components/ui/ErrorAlert'
import { EmptyState } from '@/components/ui/EmptyState'
import { DashedAddButton } from '@/components/ui/DashedAddButton'
import { PageTitle } from '@/components/ui/PageTitle'
import { ShareEventModal } from '@/components/ShareEventModal'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { STATUS_COLORS } from '@/components/ui/StatusBadge'
import type { Event } from '@/types'
import { getWizardPrefs } from '@/lib/wizard'
import { fetchTemplateDraftEventIds } from '@/lib/templates'

export function MyEvents() {
  const { user } = useAuth()
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
      const [owned, shared, draftEventIds] = await Promise.all([
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
        fetchTemplateDraftEventIds(),
      ])

      const draftIds = new Set(draftEventIds)
      const all = [...(owned.data || []), ...(shared.data || [])]
        .filter((event) => !draftIds.has(event.id))
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
        <EmptyState
          icon={<Calendar size={40} />}
          title="עדיין אין אירועים"
          description="צרו את האירוע הראשון שלכם והתחילו לנהל משתתפים, קבוצות ומשימות."
          action={
            <>
              {error && <ErrorAlert message={error} className="mb-4 max-w-sm" />}
              <Button variant="gradient" size="lg" loading={creating} onClick={handleCreateEvent}>
                <Plus size={20} className="ml-2" />
                צור אירוע ראשון
              </Button>
            </>
          }
        />
      ) : (
        <div className="space-y-4">
          <PageTitle title="האירועים שלי" size="md" />

          {error && <ErrorAlert message={error} />}
          {successMsg && <SuccessAlert message={successMsg} />}

          <div className="space-y-2">
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                isOwner={event.owner_admin_id === user!.id}
                onDelete={() => setDeletingEvent(event)}
                onShare={() => setSharingEvent(event)}
              />
            ))}
          </div>

          <DashedAddButton onClick={handleCreateEvent} disabled={creating}>
            <Plus size={16} />
            {creating ? 'יוצר...' : 'צור אירוע חדש'}
          </DashedAddButton>
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
          <p className="text-sm text-muted">
            האם את בטוחה שברצונך למחוק את האירוע{' '}
            <strong className="text-foreground">{deletingEvent?.name || 'ללא שם'}</strong>?
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
  onDelete: () => void
  onShare: () => void
}

function EventRow({ event, isOwner, onDelete, onShare }: EventRowProps) {
  const { isSuperAdmin } = useAuth()
  const isFreePlan = !isSuperAdmin && event.plan === 'free'
  const navigate = useNavigate()

  const statusLabels: Record<string, { label: string; color: string }> = {
    editing: { label: 'בעריכה', color: STATUS_COLORS.editing },
    active: { label: 'פעיל', color: STATUS_COLORS.active },
    archived: { label: 'בארכיון', color: STATUS_COLORS.archived },
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
      className="group relative flex w-full cursor-pointer items-center gap-5 px-5 py-4 text-right bg-surface hover:bg-surface-elevated transition-colors rounded-2xl border border-border overflow-hidden"
    >
      <div className="absolute right-0 top-0 h-full w-1 rounded-r-none transition-opacity opacity-60 group-hover:opacity-100 bg-accent" />

      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-elevated border border-secondary/25">
        {event.logo_url ? (
          <img src={event.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <Calendar size={22} className="text-secondary" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-base font-bold text-foreground truncate leading-snug">
            {event.name || 'אירוע ללא שם'}
          </p>
          {isFreePlan && <Badge label="משחק התנסות" color="var(--color-primary)" />}
        </div>
        <p className="text-xs text-muted mt-0.5">
          נוצר {new Date(event.created_at).toLocaleDateString('he-IL')}
        </p>
      </div>

      <div className="shrink-0">
        <Badge label={status.label} color={status.color} />
      </div>

      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
        <Button variant="ghost" size="xs" onClick={handleOpenSettings} title="הגדרות">
          <Settings2 size={13} className="ml-1" />
          הגדרות
        </Button>
        <Button variant="ghost" size="xs" onClick={handleOpenControl} disabled={isWip} title={isWip ? 'האירוע עדיין בעריכה' : 'להתחיל לשחק'}>
          <ExternalLink size={13} className="ml-1" />
          להתחיל לשחק
        </Button>
        <Button variant="ghost" size="xs" onClick={handleShare}>
          <Share2 size={13} className="ml-1" />
          שיתוף
        </Button>
        {isOwner && (
          <Button
            variant="ghost"
            size="xs"
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 hover:bg-surface-elevated hover:text-danger"
          >
            <Trash2 size={13} className="ml-1" />
            מחיקה
          </Button>
        )}
      </div>
    </div>
  )
}
