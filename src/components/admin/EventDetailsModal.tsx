import { useEffect, useState } from 'react'
import { Layers, Users, CheckSquare, Gift, Star, SlidersHorizontal, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Tabs } from '@/components/ui/Tabs'
import { ColorDot } from '@/components/ui/ColorDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { EventFeaturesPanel } from '@/components/admin/EventFeaturesPanel'
import type { Group, UserPlan } from '@/types'

interface EventDetailsModalProps {
  eventId: string
  eventName: string
  /** The game's plan - the baseline a feature flag overrides. */
  plan: UserPlan
  onClose: () => void
  /** A feature flag changed, so a parent list's summary is now stale. */
  onFeaturesChanged?: () => void
  /**
   * The game was deleted with everything hanging off it. Passing this is what
   * puts the delete button in the dialog - the caller has to be somewhere the
   * row can actually disappear from.
   */
  onDeleted?: () => void
}

interface GroupRow extends Group {
  member_count: number
}

interface ParticipantRow {
  id: string
  name: string
  external_id: string
  groups: Group[]
}

interface ActionRow {
  id: string
  name: string
  points: number
  max_completions: number | null
  groups: Group[]
}

interface RewardRow {
  id: string
  name: string
  required_points: number
  target_type: string
  winner_mode: string
  groups: Group[]
}

interface GroupJoin {
  group_id: string
  groups: Group
}

type DetailTab = 'groups' | 'participants' | 'actions' | 'rewards' | 'features'

export function EventDetailsModal({
  eventId,
  eventName,
  plan,
  onClose,
  onFeaturesChanged,
  onDeleted,
}: EventDetailsModalProps) {
  const [tab, setTab] = useState<DetailTab>('groups')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [actions, setActions] = useState<ActionRow[]>([])
  const [rewards, setRewards] = useState<RewardRow[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      const [groupsRes, participantsRes, actionsRes, rewardsRes] = await Promise.all([
        supabase
          .from('groups')
          .select('*, participant_groups(count)')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true }),
        supabase
          .from('participants')
          .select('*, participant_groups(group_id, groups(*))')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true }),
        supabase
          .from('actions')
          .select('*, action_groups(group_id, groups(*))')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true }),
        supabase
          .from('rewards')
          .select('*, reward_groups(group_id, groups(*))')
          .eq('event_id', eventId)
          .order('required_points', { ascending: true }),
      ])

      if (cancelled) return

      const firstError =
        groupsRes.error || participantsRes.error || actionsRes.error || rewardsRes.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      setGroups(
        (groupsRes.data ?? []).map((g) => ({
          ...g,
          member_count: (g.participant_groups as unknown as { count: number }[])?.[0]?.count ?? 0,
        })),
      )
      setParticipants(
        (participantsRes.data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          external_id: p.external_id,
          groups: ((p.participant_groups as unknown as GroupJoin[]) ?? []).map((pg) => pg.groups),
        })),
      )
      setActions(
        (actionsRes.data ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          points: a.points,
          max_completions: a.max_completions,
          groups: ((a.action_groups as unknown as GroupJoin[]) ?? []).map((ag) => ag.groups),
        })),
      )
      setRewards(
        (rewardsRes.data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          required_points: r.required_points,
          target_type: r.target_type ?? 'all',
          winner_mode: r.winner_mode ?? 'all',
          groups: ((r.reward_groups as unknown as GroupJoin[]) ?? []).map((rg) => rg.groups),
        })),
      )
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [eventId])

  /** Drops the game and every record under it (091). */
  async function deleteEvent() {
    setDeleting(true)
    setDeleteError('')

    const { error: rpcError } = await supabase.rpc('delete_event_admin', {
      p_event_id: eventId,
    })

    setDeleting(false)

    if (rpcError) {
      setDeleteError(rpcError.message)
      return
    }

    setConfirmingDelete(false)
    onDeleted?.()
  }

  const TABS: { id: DetailTab; label: string; icon: typeof Layers; count: number | null }[] = [
    { id: 'groups', label: 'קבוצות', icon: Layers, count: groups.length },
    { id: 'participants', label: 'משתתפים', icon: Users, count: participants.length },
    { id: 'actions', label: 'משימות', icon: CheckSquare, count: actions.length },
    { id: 'rewards', label: 'פרסים', icon: Gift, count: rewards.length },
    { id: 'features', label: 'פיצ׳ר פלאגים', icon: SlidersHorizontal, count: null },
  ]

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title={eventName?.trim() || 'פרטי האירוע'}
        dialogClassName="max-w-3xl h-[min(85vh,760px)]"
        contentClassName="!flex !min-h-0 !flex-1 !flex-col !overflow-hidden !p-0"
        footer={
          onDeleted ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">
                מחיקת האירוע מוחקת גם את כל הרשומות שלו, ללא אפשרות שחזור.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeleteError('')
                  setConfirmingDelete(true)
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-danger/40 px-3 py-2 text-xs font-medium text-danger-text transition-colors hover:bg-danger/10"
              >
                <Trash2 size={14} />
                מחק אירוע
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 px-5 pt-4">
            <Tabs
              tabs={TABS.map(({ id, label, icon: Icon, count }) => ({
                id,
                label: count == null ? label : `${label} (${count})`,
                icon: <Icon size={15} />,
              }))}
              activeTab={tab}
              onChange={(id) => setTab(id as DetailTab)}
              variant="underline"
              className="!mb-0"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {tab === 'features' ? (
              <EventFeaturesPanel eventId={eventId} plan={plan} onChanged={onFeaturesChanged} />
            ) : loading ? (
              <CenteredLoader />
            ) : error ? (
              <ErrorAlert message={`שגיאה בטעינת המידע: ${error}`} />
            ) : (
              <>
                {tab === 'groups' && (
                  groups.length === 0 ? (
                    <EmptyState compact icon={<Layers size={24} />} title="אין קבוצות" description="לא הוגדרו קבוצות באירוע זה" />
                  ) : (
                    <div className="space-y-2">
                      {groups.map((g) => (
                        <div
                          key={g.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-game-border bg-white/[0.02] px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <ColorDot color={g.color} size="md" />
                            <span className="truncate text-sm font-medium text-foreground">{g.name}</span>
                          </div>
                          <span className="shrink-0 text-xs text-muted">{g.member_count} משתתפים</span>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === 'participants' && (
                  participants.length === 0 ? (
                    <EmptyState compact icon={<Users size={24} />} title="אין משתתפים" description="לא נוספו משתתפים לאירוע זה" />
                  ) : (
                    <div className="space-y-2">
                      {participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-game-border bg-white/[0.02] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                            {p.external_id && (
                              <p className="truncate text-xs text-muted" dir="ltr">{p.external_id}</p>
                            )}
                          </div>
                          {p.groups.length > 0 && (
                            <div className="flex shrink-0 flex-wrap justify-end gap-1">
                              {p.groups.map((g) => (
                                <span
                                  key={g.id}
                                  className="inline-flex items-center gap-1 rounded-full border border-game-border bg-white/5 px-2 py-0.5 text-[11px] text-muted"
                                >
                                  <ColorDot color={g.color} size="xs" />
                                  {g.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === 'actions' && (
                  actions.length === 0 ? (
                    <EmptyState compact icon={<CheckSquare size={24} />} title="אין משימות" description="לא הוגדרו משימות לצבירת נקודות" />
                  ) : (
                    <div className="space-y-2">
                      {actions.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-game-border bg-white/[0.02] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {a.groups.map((g) => (
                                <span
                                  key={g.id}
                                  className="inline-flex items-center gap-1 rounded-full border border-game-border bg-white/5 px-2 py-0.5 text-[11px] text-muted"
                                >
                                  <ColorDot color={g.color} size="xs" />
                                  {g.name}
                                </span>
                              ))}
                              {a.max_completions != null && (
                                <span className="text-[11px] text-muted">עד {a.max_completions} פעמים</span>
                              )}
                            </div>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-game-border bg-white/5 px-2.5 py-1 text-xs font-bold text-foreground">
                            <Star size={12} className="text-warning-text" />
                            {a.points.toLocaleString()} נק׳
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === 'rewards' && (
                  rewards.length === 0 ? (
                    <EmptyState compact icon={<Gift size={24} />} title="אין פרסים" description="לא הוגדרו פרסים באירוע זה" />
                  ) : (
                    <div className="space-y-2">
                      {rewards.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-game-border bg-white/[0.02] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] text-muted">
                                {r.target_type === 'groups' ? 'לקבוצות נבחרות' : 'לכל המשתתפים'}
                              </span>
                              <span className="text-[11px] text-muted">·</span>
                              <span className="text-[11px] text-muted">
                                {r.winner_mode === 'first' ? 'הזוכה הראשון' : 'כל מי שמגיע'}
                              </span>
                              {r.target_type === 'groups' && r.groups.map((g) => (
                                <span
                                  key={g.id}
                                  className="inline-flex items-center gap-1 rounded-full border border-game-border bg-white/5 px-2 py-0.5 text-[11px] text-muted"
                                >
                                  <ColorDot color={g.color} size="xs" />
                                  {g.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-game-border bg-white/5 px-2.5 py-1 text-xs font-bold text-foreground">
                            {r.required_points.toLocaleString()} נק׳
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                )}
            </>
          )}
        </div>
      </div>
    </Modal>

    <ConfirmModal
      isOpen={confirmingDelete}
      onClose={() => setConfirmingDelete(false)}
      title="מחיקת אירוע"
      confirmLabel="מחק לצמיתות"
      onConfirm={() => void deleteEvent()}
      loading={deleting}
    >
      <div className="space-y-3 text-sm">
        <p className="font-semibold text-foreground">
          האם למחוק את האירוע {eventName?.trim() || 'ללא שם'}?
        </p>
        <p className="text-muted">
          כל הרשומות של האירוע יימחקו יחד איתו — קבוצות, משתתפים, משימות, פרסים,
          סריקות והגרלות. לא ניתן לשחזר.
        </p>
        <p className="text-muted">
          הזמנות סורקים שקושרו לאירוע לא יימחקו, אלא רק ינותקו ממנו.
        </p>
        {deleteError && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-danger-text">
            שגיאה במחיקה: {deleteError}
          </p>
        )}
      </div>
    </ConfirmModal>
    </>
  )
}
