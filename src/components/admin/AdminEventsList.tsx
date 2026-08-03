import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchTemplateDraftEventIds } from '@/lib/templates'
import { fetchEventsPlayMeta } from '@/lib/eventsPlayMeta'
import { fetchEventFeatureOverrides, useFeatureCatalog } from '@/hooks/useEventFeatures'
import {
  activeFlags,
  summariseOverrides,
  type EventFeatureOverride,
  type FeatureCatalog,
} from '@/lib/eventFeatures'
import { PLAN_LABELS } from '@/lib/eventPlanLabels'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { StatusBadge, STATUS_COLORS, PLAN_BADGE_COLORS } from '@/components/ui/StatusBadge'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EventDetailsModal } from '@/components/admin/EventDetailsModal'
import { cn } from '@/lib/utils'
import type { EventStatus, UserPlan } from '@/types'

interface AdminEventRow {
  id: string
  name: string
  logo_url: string | null
  plan: UserPlan
  status: EventStatus
  created_at: string
  owner_admin_id: string
  owner_name: string
  owner_email: string
  groups: number
  participants: number
  tasks: number
  rewards: number
  scans: number
  /** Feature flags set on this game specifically, on top of its plan. */
  overrides: EventFeatureOverride[]
}

const STATUS_LABELS: Record<string, string> = {
  editing: 'בעריכה',
  active: 'פעיל',
  archived: 'בארכיון',
}

/** Plan filter chips, in the plan picker's order plus an "all" entry. */
const PLAN_FILTERS: { value: UserPlan | 'all'; label: string }[] = [
  { value: 'all', label: 'הכל' },
  ...(Object.keys(PLAN_LABELS) as UserPlan[]).map((plan) => ({
    value: plan,
    label: PLAN_LABELS[plan],
  })),
]

function ownerDisplayName(displayName: string | null, email: string) {
  return displayName?.trim() || email.split('@')[0] || email
}

export function AdminEventsList() {
  const [events, setEvents] = useState<AdminEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AdminEventRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminEventRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [planFilter, setPlanFilter] = useState<UserPlan | 'all'>('all')
  const [extrasOnly, setExtrasOnly] = useState(false)
  const { catalog } = useFeatureCatalog()

  /**
   * The flags column and filter only appear once a flag exists, so the list
   * looks exactly as it did before feature flags until there is one to show.
   */
  const showFeatures = activeFlags(catalog).length > 0

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [eventsRes, draftIds] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, logo_url, plan, status, created_at, owner_admin_id')
        .neq('status', 'archived')
        .order('created_at', { ascending: false }),
      fetchTemplateDraftEventIds(),
    ])

    if (eventsRes.error) {
      setError(eventsRes.error.message)
      setEvents([])
      setLoading(false)
      return
    }

    const draftSet = new Set(draftIds)
    const rows = (eventsRes.data ?? []).filter((row) => !draftSet.has(row.id))
    const ownerIds = [...new Set(rows.map((row) => row.owner_admin_id))]
    const eventIds = rows.map((row) => row.id)

    const [profilesResult, playMeta, overrides] = await Promise.all([
      ownerIds.length > 0
        ? supabase
            .from('user_profiles')
            .select('id, display_name, email')
            .in('id', ownerIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null; email: string }[], error: null }),
      fetchEventsPlayMeta(eventIds),
      // Missing table / read failure just means "no game has a flag yet".
      fetchEventFeatureOverrides(eventIds).catch(
        () => ({}) as Record<string, EventFeatureOverride[]>,
      ),
    ])

    if (profilesResult.error) {
      setError(profilesResult.error.message)
      setEvents([])
      setLoading(false)
      return
    }

    const profileMap = new Map(
      (profilesResult.data ?? []).map((p) => [p.id, { display_name: p.display_name, email: p.email }]),
    )

    setEvents(
      rows.map((row) => {
        const profile = profileMap.get(row.owner_admin_id)
        const email = profile?.email ?? ''
        const counts = playMeta[row.id]?.counts
        return {
          id: row.id,
          name: row.name,
          logo_url: row.logo_url,
          plan: row.plan as UserPlan,
          status: row.status as EventStatus,
          created_at: row.created_at,
          owner_admin_id: row.owner_admin_id,
          owner_name: profile ? ownerDisplayName(profile.display_name, email) : 'משתמש לא ידוע',
          owner_email: email,
          groups: counts?.groups ?? 0,
          participants: counts?.participants ?? 0,
          tasks: counts?.tasks ?? 0,
          rewards: counts?.rewards ?? 0,
          scans: playMeta[row.id]?.totalScans ?? 0,
          overrides: overrides[row.id] ?? [],
        }
      }),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  /**
   * Drops the game and everything hanging off it (091). The list holds the
   * counts already, so the row just disappears instead of a refetch.
   */
  const deleteEvent = useCallback(async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleting(true)
    setDeleteError(null)

    const { error: rpcError } = await supabase.rpc('delete_event_admin', {
      p_event_id: target.id,
    })

    setDeleting(false)

    if (rpcError) {
      setDeleteError(rpcError.message)
      return
    }

    setEvents((prev) => prev.filter((event) => event.id !== target.id))
    setPreview((prev) => (prev?.id === target.id ? null : prev))
    setDeleteTarget(null)
  }, [deleteTarget])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return events.filter((event) => {
      if (planFilter !== 'all' && event.plan !== planFilter) return false
      if (extrasOnly && showFeatures) {
        const { granted, withheld } = summariseOverrides(catalog, event.plan, event.overrides)
        if (granted === 0 && withheld === 0) return false
      }
      if (!needle) return true
      return (
        event.name.toLowerCase().includes(needle) ||
        event.owner_name.toLowerCase().includes(needle) ||
        event.owner_email.toLowerCase().includes(needle)
      )
    })
  }, [catalog, events, query, planFilter, extrasOnly, showFeatures])

  const extrasCount = useMemo(
    () =>
      events.filter((event) => {
        const { granted, withheld } = summariseOverrides(catalog, event.plan, event.overrides)
        return granted > 0 || withheld > 0
      }).length,
    [catalog, events],
  )

  const filtered = query.trim() !== '' || planFilter !== 'all' || extrasOnly

  if (loading) return <FullPageLoader />

  return (
    <>
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          שגיאה בטעינת אירועים: {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[13rem] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם משחק, לקוח או אימייל"
            aria-label="חיפוש משחקים"
            className="!pr-9"
          />
        </div>

        {showFeatures && (
          <button
            type="button"
            aria-pressed={extrasOnly}
            onClick={() => setExtrasOnly((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-medium transition-colors',
              extrasOnly
                ? 'border-success/45 bg-success/10 text-success-text'
                : 'border-border bg-surface text-muted hover:text-foreground',
            )}
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            עם פיצ׳ר פלאגים ({extrasCount})
          </button>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {PLAN_FILTERS.map((option) => {
          const active = planFilter === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setPlanFilter(option.value)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
                active
                  ? 'border-primary/50 bg-primary/10 text-primary-text'
                  : 'border-border bg-surface text-muted hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          )
        })}
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setPlanFilter('all')
              setExtrasOnly(false)
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted hover:text-foreground"
          >
            <X size={12} aria-hidden="true" />
            נקה סינון
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Calendar size={18} className="text-gray-400" />
        <h2 className="text-sm font-medium text-gray-400">
          {filtered ? `${visible.length} מתוך ${events.length} אירועים` : `${events.length} אירועים`}
        </h2>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<Calendar size={32} />}
          title="אין אירועים"
          description="אירועים שנוצרו על ידי לקוחות יופיעו כאן"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Search size={32} />}
          title="אין תוצאות"
          description="נסו שם אחר, או נקו את הסינון"
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-sm">
              <thead>
                <tr className="border-b border-game-border bg-white/[0.02] text-xs text-muted">
                  <th scope="col" className="px-4 py-3 text-right font-medium">שם האירוע</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">משתמש</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">תוכנית</th>
                  {showFeatures && (
                    <th scope="col" className="px-4 py-3 text-right font-medium">פיצ׳ר פלאגים</th>
                  )}
                  <th scope="col" className="px-4 py-3 text-right font-medium">סטטוס</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">קבוצות</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">משתתפים</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">משימות</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">פרסים</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">מספר סריקות</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">נוצר</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-game-border/50">
                {visible.map((event) => (
                  <tr
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPreview(event)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setPreview(event)
                      }
                    }}
                    className="cursor-pointer hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-game-border bg-white/[0.04]">
                          {event.logo_url ? (
                            <img
                              src={event.logo_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Calendar size={16} className="text-muted/50" />
                          )}
                        </div>
                        <span className="font-medium text-foreground">
                          {event.name?.trim() || (
                            <span className="italic text-muted">ללא שם</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-foreground">{event.owner_name}</p>
                        {event.owner_email && (
                          <p className="truncate text-xs text-muted" dir="ltr">
                            {event.owner_email}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={PLAN_LABELS[event.plan] ?? event.plan}
                        color={PLAN_BADGE_COLORS[event.plan] ?? 'var(--color-muted)'}
                      />
                    </td>
                    {showFeatures && (
                      <td className="px-4 py-3">
                        <ExtrasCell catalog={catalog} plan={event.plan} overrides={event.overrides} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={STATUS_LABELS[event.status] ?? event.status}
                        color={STATUS_COLORS[event.status as keyof typeof STATUS_COLORS] ?? 'var(--color-muted)'}
                      />
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted">{event.groups}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted">{event.participants}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted">{event.tasks}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted">{event.rewards}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted">{event.scans}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {new Date(event.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button
                        type="button"
                        title="מחק אירוע"
                        aria-label={`מחק את האירוע ${event.name?.trim() || 'ללא שם'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteError(null)
                          setDeleteTarget(event)
                        }}
                        // The row itself opens the details modal on Enter/Space.
                        onKeyDown={(e) => e.stopPropagation()}
                        className="flex items-center justify-center rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger-text"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {preview && (
        <EventDetailsModal
          eventId={preview.id}
          eventName={preview.name?.trim() || 'ללא שם'}
          plan={preview.plan}
          onClose={() => setPreview(null)}
          onFeaturesChanged={() => void fetchEvents()}
          onDeleted={() => {
            setEvents((prev) => prev.filter((event) => event.id !== preview.id))
            setPreview(null)
          }}
        />
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="מחיקת אירוע"
        confirmLabel="מחק לצמיתות"
        onConfirm={() => void deleteEvent()}
        loading={deleting}
      >
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-foreground">
            האם למחוק את האירוע {deleteTarget?.name?.trim() || 'ללא שם'}
            {deleteTarget?.owner_name && <> של {deleteTarget.owner_name}</>}?
          </p>
          <p className="text-muted">
            כל הרשומות של האירוע יימחקו יחד איתו
            {deleteTarget && <> — {contentSummary(deleteTarget)}</>}. לא ניתן לשחזר.
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

/** "12 משתתפים, 3 קבוצות" - only what this game actually has. */
function contentSummary(event: AdminEventRow) {
  const parts = [
    [event.participants, 'משתתפים'],
    [event.groups, 'קבוצות'],
    [event.tasks, 'משימות'],
    [event.rewards, 'פרסים'],
    [event.scans, 'סריקות'],
  ] as const

  const filled = parts.filter(([count]) => count > 0)

  if (filled.length === 0) return 'האירוע ריק מתוכן'

  return filled.map(([count, label]) => `${count} ${label}`).join(', ')
}

/** "+2 / -1" for a game whose flags differ from its plan; a dash otherwise. */
function ExtrasCell({
  catalog,
  plan,
  overrides,
}: {
  catalog: FeatureCatalog
  plan: UserPlan
  overrides: EventFeatureOverride[]
}) {
  const { granted, withheld } = summariseOverrides(catalog, plan, overrides)

  if (granted === 0 && withheld === 0) {
    return <span className="text-xs text-muted/60">לפי התוכנית</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      {granted > 0 && (
        <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success-text">
          +{granted}
        </span>
      )}
      {withheld > 0 && (
        <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger-text">
          −{withheld}
        </span>
      )}
    </div>
  )
}
