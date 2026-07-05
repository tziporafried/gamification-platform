import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, Share2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Toast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { DeleteButton, IconButton } from '@/components/ui/IconButton'
import { PageTitle } from '@/components/ui/PageTitle'
import { ShareEventModal } from '@/components/ShareEventModal'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { fetchEventsPlayMeta, type EventPlayMeta } from '@/lib/eventsPlayMeta'
import { EventPlayStatus, resolveEventPlayStatus, EVENT_PLAY_STATUS } from '@/components/event/EventPlayStatus'
import { isEventReady, getWizardPrefs } from '@/lib/wizard'
import { fetchTemplateDraftEventIds } from '@/lib/templates'
import type { Event as GameEvent } from '@/types'
import { cn } from '@/lib/utils'

const EVENT_CARD_CLASS = cn(
  'group relative flex w-full cursor-pointer items-center gap-4 px-5 py-3.5 text-right',
  'overflow-hidden rounded-2xl border border-border/30 bg-surface-elevated shadow-event-card',
  'transition-[box-shadow,border-color,transform] duration-[180ms] ease-out',
  'hover:-translate-y-0.5 hover:border-border/45 hover:shadow-event-card-hover',
)

const CREATE_EVENT_BTN_CLASS = cn(
  'gap-1.5 shrink-0 !px-4 !py-1',
  '!bg-[color-mix(in_srgb,var(--color-primary)_90%,var(--color-background))]',
  'shadow-none hover:!bg-primary-hover hover:shadow-sm',
  'transition-all duration-[180ms] ease-out',
)

export function MyEvents() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<GameEvent[]>([])
  const [playMeta, setPlayMeta] = useState<Record<string, EventPlayMeta>>({})
  const [loading, setLoading] = useState(true)
  const [deletingEvent, setDeletingEvent] = useState<GameEvent | null>(null)
  const [sharingEvent, setSharingEvent] = useState<GameEvent | null>(null)
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
            if (!collabs?.length) return { data: [] as GameEvent[] }
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
      if (all.length > 0) {
        const meta = await fetchEventsPlayMeta(all.map((event) => event.id))
        setPlayMeta(meta)
      }
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
  }

  if (loading) return <FullPageLoader />

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
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
        <div className="w-full space-y-4 text-right">
          <PageTitle
            title="האירועים שלי"
            size="md"
            action={
              <Button
                size="sm"
                className={CREATE_EVENT_BTN_CLASS}
                loading={creating}
                onClick={handleCreateEvent}
              >
                <Plus size={16} className="shrink-0" strokeWidth={2.5} />
                {creating ? 'יוצר...' : 'צור אירוע חדש'}
              </Button>
            }
          />

          {error && <ErrorAlert message={error} />}

          <div className="space-y-2 py-1">
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                playMeta={playMeta[event.id]}
                isOwner={event.owner_admin_id === user!.id}
                onDelete={() => setDeletingEvent(event)}
                onShare={() => setSharingEvent(event)}
              />
            ))}
          </div>
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
          <ModalActions className="pt-0">
            <Button variant="danger" loading={deleting} onClick={handleDeleteEvent}>
              מחק אירוע
            </Button>
            <Button variant="outline" onClick={() => setDeletingEvent(null)}>
              ביטול
            </Button>
          </ModalActions>
        </div>
      </Modal>

      {successMsg && (
        <Toast
          message={successMsg}
          variant="success"
          autoDismissMs={3000}
          onDismiss={() => setSuccessMsg('')}
        />
      )}
    </main>
  )
}

interface EventRowProps {
  event: GameEvent
  playMeta?: EventPlayMeta
  isOwner: boolean
  onDelete: () => void
  onShare: () => void
}

function EventRow({ event: gameEvent, playMeta, isOwner, onDelete, onShare }: EventRowProps) {
  const { isSuperAdmin } = useAuth()
  const isFreePlan = !isSuperAdmin && gameEvent.plan === 'free'
  const navigate = useNavigate()

  const isReady = useMemo(() => {
    if (!playMeta) return false
    return isEventReady(gameEvent, playMeta.counts)
  }, [gameEvent, playMeta])

  const playStatus = useMemo(() => {
    if (!playMeta) return 'preparing' as const
    return resolveEventPlayStatus(isReady, playMeta.totalScans)
  }, [isReady, playMeta])

  const statusColor = EVENT_PLAY_STATUS[playStatus].color

  function navigateToPlay() {
    if (isReady) {
      navigate(`/events/${gameEvent.id}/control`)
      return
    }
    navigate(`/events/${gameEvent.id}/step/${getWizardPrefs(gameEvent.id).lastStep}`)
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    onDelete()
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    onShare()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={navigateToPlay}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToPlay() } }}
      className={EVENT_CARD_CLASS}
    >
      <div
        className="absolute right-0 top-0 h-full w-1 rounded-r-none transition-opacity duration-[180ms] ease-out opacity-35 group-hover:opacity-48"
        style={{ backgroundColor: statusColor }}
      />

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/20 bg-surface-elevated/50">
        {gameEvent.logo_url ? (
          <img src={gameEvent.logo_url} alt="" className="h-9 w-9 rounded-xl object-cover" />
        ) : (
          <Calendar size={16} className="shrink-0 text-muted/50" />
        )}
      </div>

      <div className="min-w-0 flex-1 self-center">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-base font-extrabold tracking-tight text-foreground leading-snug">
            {gameEvent.name || 'אירוע ללא שם'}
          </p>
          <p className="shrink-0 text-[11px] leading-none text-muted/45">
            נוצר {new Date(gameEvent.created_at).toLocaleDateString('he-IL')}
          </p>
          {isFreePlan && <Badge label="משחק התנסות" color="var(--color-primary)" variant="quiet" />}
        </div>
      </div>

      <div className="flex shrink-0 items-center self-stretch py-0.5">
        <EventPlayStatus status={playStatus} variant="badge" />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 self-center" onClick={e => e.stopPropagation()}>
        <IconButton
          variant="default"
          title="שיתוף"
          className="text-foreground/75 transition-colors duration-[180ms] ease-out hover:text-foreground"
          onClick={handleShare}
        >
          <Share2 size={13} strokeWidth={2} />
        </IconButton>
        <div className="flex h-[26px] w-7 shrink-0 items-center justify-center">
          {isOwner && (
            <DeleteButton
              revealOnHover
              iconSize={13}
              title="מחיקה"
              className="text-foreground/75 transition-colors duration-[180ms] ease-out hover:text-danger"
              onClick={handleDelete}
            />
          )}
        </div>
      </div>
    </div>
  )
}
