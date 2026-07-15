import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Crown, Users, ListTodo, MessageSquare, Sparkles, ChevronDown, Loader2, CheckCircle, Trash2, BarChart3, Calendar, Wallet, ScanLine } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { AdminStatusPill } from '@/components/ui/StatusBadge'
import { DevTodoList } from '@/components/dev-todos/DevTodoList'
import { TemplateAdminList } from '@/components/admin/TemplateAdminList'
import { AdminAnalyticsDashboard } from '@/components/admin/analytics/AdminAnalyticsDashboard'
import { AdminEventsList } from '@/components/admin/AdminEventsList'
import { AdminFinancePanel } from '@/components/admin/AdminFinancePanel'
import { AdminScannersPanel } from '@/components/admin/AdminScannersPanel'
import { EventDetailsModal } from '@/components/admin/EventDetailsModal'
import { TrialActivationResetModal } from '@/components/TrialActivationResetModal'
import { trackTrialActivated, trackTrialDataReset } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import type { UserPlan } from '@/types'

type AdminTab = 'todos' | 'customers' | 'upgrade-requests' | 'templates' | 'analytics' | 'events' | 'finance' | 'scanners'

const TABS: { id: AdminTab; label: string; icon: typeof ListTodo }[] = [
  { id: 'todos', label: 'משימות פיתוח', icon: ListTodo },
  { id: 'templates', label: 'תבניות', icon: Sparkles },
  { id: 'customers', label: 'לקוחות', icon: Users },
  { id: 'events', label: 'אירועים', icon: Calendar },
  { id: 'upgrade-requests', label: 'פניות הפעלה', icon: MessageSquare },
  { id: 'scanners', label: 'סורקים', icon: ScanLine },
  { id: 'finance', label: 'הכנסות והוצאות', icon: Wallet },
  { id: 'analytics', label: 'אנליטיקות', icon: BarChart3 },
]

interface AdminUser {
  user_id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role: string
  created_at: string
  last_sign_in_at: string | null
  event_count: number
  event_names: string
}

interface AdminEventRow {
  event_id: string
  event_name: string
  plan: UserPlan
  status: string
  created_at: string
}

interface UpgradeRequest {
  id: string
  user_id: string
  event_id: string | null
  full_name: string
  email: string
  phone: string
  notes: string | null
  limit_type: string
  status: string
  created_at: string
  events: { name: string | null } | null
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'חדש' },
  { value: 'contacted', label: 'נוצר קשר' },
  { value: 'closed', label: 'נסגר' },
]

const LIMIT_LABELS: Record<string, string> = {
  participants: 'משתתפים',
  groups: 'קבוצות',
  actions: 'משימות',
  rewards: 'פרסים',
  general: 'כללי',
  'plan-independent': 'משחק עצמאי',
  'plan-full': 'חוויה מלאה',
  'plan-organizations': 'פתרון לארגונים',
  homepage_contact: 'פנייה כללית (דף הבית)',
  trial_contact: 'פנייה כללית (התנסות)',
}

const LIMIT_TYPE_TO_PLAN: Record<string, string> = {
  'plan-independent': 'independent',
  'plan-full': 'full',
  'plan-organizations': 'organizations',
}

const PLAN_OPTIONS: { value: UserPlan; label: string; color: string }[] = [
  { value: 'free',          label: 'התנסות',    color: 'text-gray-400' },
  { value: 'independent',   label: 'עצמאי',      color: 'text-blue-400' },
  { value: 'full',          label: 'מלא',        color: 'text-green-400' },
  { value: 'organizations', label: 'ארגונים',    color: 'text-amber-400' },
]

function planLabel(plan: UserPlan) {
  return PLAN_OPTIONS.find(p => p.value === plan)?.label ?? plan
}

function planColor(plan: UserPlan) {
  return PLAN_OPTIONS.find(p => p.value === plan)?.color ?? 'text-gray-400'
}

function formatLastSignIn(iso: string | null) {
  if (!iso) return 'טרם התחבר'
  const d = new Date(iso)
  const date = d.toLocaleDateString('he-IL')
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

export function AdminPanel() {
  const location = useLocation()
  const { user: currentUser } = useAuth()
  const [tab, setTab] = useState<AdminTab>('todos')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [requestsLoaded, setRequestsLoaded] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [newRequestCount, setNewRequestCount] = useState(0)
  const [upgradingEventId, setUpgradingEventId] = useState<string | null>(null)
  const [usersError, setUsersError] = useState<string | null>(null)

  // Per-user event expansion state
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [loadingEventsFor, setLoadingEventsFor] = useState<Set<string>>(new Set())
  const [userEvents, setUserEvents] = useState<Map<string, AdminEventRow[]>>(new Map())
  const [updatingEventPlanId, setUpdatingEventPlanId] = useState<string | null>(null)
  const [detailEvent, setDetailEvent] = useState<{ id: string; name: string } | null>(null)

  // User deletion
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deletingUser, setDeletingUser] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Upgrade request deletion
  const [deleteRequestTarget, setDeleteRequestTarget] = useState<UpgradeRequest | null>(null)
  const [deletingRequest, setDeletingRequest] = useState(false)
  const [deleteRequestError, setDeleteRequestError] = useState<string | null>(null)

  // Trial → activation confirm (clears trial runtime data once)
  const [pendingPlanChange, setPendingPlanChange] = useState<{
    kind: 'dropdown' | 'request'
    userId?: string
    requestId?: string
    eventId: string
    previousPlan: UserPlan
    newPlan: UserPlan
  } | null>(null)
  const [activatingPlan, setActivatingPlan] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    setUsersError(null)
    const { data, error } = await supabase.rpc('get_all_users_admin')
    if (error) {
      setUsersError(error.message)
    } else if (data) {
      setUsers(data as AdminUser[])
    }
    setUsersLoaded(true)
    setLoadingUsers(false)
  }, [])

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true)
    const { data } = await supabase
      .from('contact_upgrade_requests')
      .select('*, events(name)')
      .order('created_at', { ascending: false })
    if (data) {
      setRequests(data as UpgradeRequest[])
      setNewRequestCount(data.filter((r) => r.status === 'new').length)
    }
    setRequestsLoaded(true)
    setLoadingRequests(false)
  }, [])

  useEffect(() => {
    supabase
      .from('contact_upgrade_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new')
      .then(({ count }) => setNewRequestCount(count ?? 0))
  }, [])

  useEffect(() => {
    const requestedTab = (location.state as { tab?: AdminTab } | null)?.tab
    if (requestedTab) setTab(requestedTab)
  }, [location.state])

  useEffect(() => {
    if (tab === 'customers' && !usersLoaded) fetchUsers()
    if (tab === 'upgrade-requests' && !requestsLoaded) fetchRequests()
  }, [tab, usersLoaded, requestsLoaded, fetchUsers, fetchRequests])

  async function toggleUserEvents(userId: string) {
    if (expandedUsers.has(userId)) {
      setExpandedUsers(prev => { const next = new Set(prev); next.delete(userId); return next })
      return
    }
    setExpandedUsers(prev => new Set(prev).add(userId))
    if (userEvents.has(userId)) return

    setLoadingEventsFor(prev => new Set(prev).add(userId))
    const { data } = await supabase.rpc('get_user_events_admin', { p_user_id: userId })
    if (data) {
      setUserEvents(prev => new Map(prev).set(userId, data as AdminEventRow[]))
    }
    setLoadingEventsFor(prev => { const next = new Set(prev); next.delete(userId); return next })
  }

  async function applyEventPlanChange(
    eventId: string,
    newPlan: UserPlan,
    opts?: { userId?: string; requestId?: string },
  ) {
    const { data, error } = await supabase.rpc('update_event_plan', {
      p_event_id: eventId,
      p_new_plan: newPlan,
    })
    if (error) return { ok: false as const, error }

    const result = data as {
      previous_plan?: string
      new_plan?: string
      did_reset?: boolean
      trial_scans_used?: number
    } | null

    if (opts?.userId) {
      setUserEvents(prev => {
        const events = prev.get(opts.userId!)
        if (!events) return prev
        return new Map(prev).set(
          opts.userId!,
          events.map(e => e.event_id === eventId ? { ...e, plan: newPlan } : e),
        )
      })
    }

    if (opts?.requestId) {
      await updateRequestStatus(opts.requestId, 'closed')
    }

    if (result?.previous_plan === 'free' && result.new_plan && result.new_plan !== 'free') {
      trackTrialActivated(eventId, result.new_plan, result.trial_scans_used ?? 0)
      if (result.did_reset) {
        trackTrialDataReset(eventId)
      }
    }

    return { ok: true as const }
  }

  function requestEventPlanChange(
    userId: string,
    eventId: string,
    previousPlan: UserPlan,
    newPlan: UserPlan,
  ) {
    if (previousPlan === newPlan) return
    if (previousPlan === 'free' && newPlan !== 'free') {
      setPendingPlanChange({ kind: 'dropdown', userId, eventId, previousPlan, newPlan })
      return
    }
    void (async () => {
      setUpdatingEventPlanId(eventId)
      await applyEventPlanChange(eventId, newPlan, { userId })
      setUpdatingEventPlanId(null)
    })()
  }

  async function changeEventPlan(userId: string, eventId: string, newPlan: UserPlan) {
    const events = userEvents.get(userId)
    const previousPlan = events?.find(e => e.event_id === eventId)?.plan ?? 'free'
    requestEventPlanChange(userId, eventId, previousPlan, newPlan)
  }

  function upgradeEventPlan(requestId: string, eventId: string, newPlan: string) {
    setPendingPlanChange({
      kind: 'request',
      requestId,
      eventId,
      previousPlan: 'free',
      newPlan: newPlan as UserPlan,
    })
  }

  async function confirmPendingPlanChange() {
    if (!pendingPlanChange) return
    setActivatingPlan(true)
    const { kind, userId, requestId, eventId, newPlan } = pendingPlanChange
    if (kind === 'dropdown') {
      setUpdatingEventPlanId(eventId)
      await applyEventPlanChange(eventId, newPlan, { userId })
      setUpdatingEventPlanId(null)
    } else {
      setUpgradingEventId(requestId!)
      await applyEventPlanChange(eventId, newPlan, { requestId })
      setUpgradingEventId(null)
    }
    setActivatingPlan(false)
    setPendingPlanChange(null)
  }

  async function deleteUser() {
    if (!deleteTarget) return
    setDeletingUser(true)
    setDeleteError(null)
    const { error } = await supabase.rpc('delete_user_admin', { p_user_id: deleteTarget.user_id })
    if (error) {
      setDeleteError(error.message)
      setDeletingUser(false)
      return
    }
    setUsers(prev => prev.filter(u => u.user_id !== deleteTarget.user_id))
    setUserEvents(prev => { const next = new Map(prev); next.delete(deleteTarget.user_id); return next })
    setExpandedUsers(prev => { const next = new Set(prev); next.delete(deleteTarget.user_id); return next })
    setDeletingUser(false)
    setDeleteTarget(null)
  }

  async function updateRequestStatus(requestId: string, newStatus: string) {
    const { error } = await supabase
      .from('contact_upgrade_requests')
      .update({ status: newStatus })
      .eq('id', requestId)
    if (!error) {
      setRequests(prev => prev.map(r =>
        r.id === requestId ? { ...r, status: newStatus } : r
      ))
      setNewRequestCount((prev) => {
        const req = requests.find((r) => r.id === requestId)
        if (!req) return prev
        if (req.status === 'new' && newStatus !== 'new') return Math.max(0, prev - 1)
        if (req.status !== 'new' && newStatus === 'new') return prev + 1
        return prev
      })
    }
  }

  async function deleteRequest() {
    if (!deleteRequestTarget) return
    const target = deleteRequestTarget
    setDeletingRequest(true)
    setDeleteRequestError(null)
    const { error } = await supabase
      .from('contact_upgrade_requests')
      .delete()
      .eq('id', target.id)
    if (error) {
      setDeleteRequestError(error.message)
      setDeletingRequest(false)
      return
    }
    setRequests(prev => prev.filter(r => r.id !== target.id))
    if (target.status === 'new') setNewRequestCount(prev => Math.max(0, prev - 1))
    setDeletingRequest(false)
    setDeleteRequestTarget(null)
  }

  return (
    <main className={cn('mx-auto px-4 py-6', tab === 'analytics' ? 'max-w-7xl' : tab === 'events' || tab === 'scanners' ? 'max-w-6xl' : 'max-w-5xl')}>
      <Tabs
        tabs={TABS.map(({ id, label, icon: Icon }) => ({
          id,
          label,
          icon: (
            <>
              <Icon size={16} />
              {id === 'upgrade-requests' && newRequestCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-foreground">
                  {newRequestCount}
                </span>
              )}
            </>
          ),
        }))}
        activeTab={tab}
        onChange={(id) => setTab(id as AdminTab)}
        variant="underline"
      />

      {tab === 'todos' && <DevTodoList />}

      {tab === 'templates' && <TemplateAdminList />}

      {tab === 'events' && <AdminEventsList />}

      {tab === 'finance' && <AdminFinancePanel />}

      {tab === 'scanners' && <AdminScannersPanel />}

      {tab === 'customers' && (
        loadingUsers ? (
          <FullPageLoader />
        ) : (
          <>
          {usersError && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              שגיאה בטעינת משתמשים: {usersError}
            </div>
          )}
          <div className="flex items-center gap-2 mb-6">
            <Users size={18} className="text-gray-400" />
            <h2 className="text-sm font-medium text-gray-400">
              {users.length} משתמשים רשומים
            </h2>
          </div>

          <div className="space-y-2">
            {users.map(user => {
              const isExpanded = expandedUsers.has(user.user_id)
              const isLoadingEvents = loadingEventsFor.has(user.user_id)
              const events = userEvents.get(user.user_id) ?? []

              return (
                <Card key={user.user_id} className="overflow-hidden">
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600/20 shrink-0">
                          <span className="text-sm font-bold text-brand-400">
                            {(user.display_name || user.email)[0]?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {user.display_name || user.email.split('@')[0]}
                          </span>
                          {user.role === 'super_admin' && (
                            <Crown size={14} className="text-warning shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted truncate">{user.email}</p>
                        <p className="text-xs text-muted mt-0.5">
                          הצטרף {new Date(user.created_at).toLocaleDateString('he-IL')}
                          {user.event_count > 0 && <> · {user.event_count} אירועים</>}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          כניסה אחרונה: {formatLastSignIn(user.last_sign_in_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {user.event_count > 0 && (
                        <button
                          onClick={() => toggleUserEvents(user.user_id)}
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-white/5 hover:text-foreground transition-colors"
                        >
                          {isLoadingEvents ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <ChevronDown
                              size={14}
                              className={cn('transition-transform duration-200', isExpanded && 'rotate-180')}
                            />
                          )}
                          אירועים
                        </button>
                      )}
                      {user.role !== 'super_admin' && user.user_id !== currentUser?.id && (
                        <button
                          onClick={() => { setDeleteError(null); setDeleteTarget(user) }}
                          title="מחק משתמש"
                          className="flex items-center justify-center rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-game-border divide-y divide-game-border/50">
                      {events.length === 0 && !isLoadingEvents ? (
                        <p className="px-4 py-3 text-xs text-muted text-center">אין אירועים פעילים</p>
                      ) : (
                        events.map(ev => (
                          <div key={ev.event_id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                            <button
                              type="button"
                              onClick={() => setDetailEvent({ id: ev.event_id, name: ev.event_name })}
                              className="flex-1 truncate text-right text-sm text-foreground hover:text-brand-400 hover:underline transition-colors"
                            >
                              {ev.event_name || <span className="text-muted italic">ללא שם</span>}
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={cn('text-xs font-medium', planColor(ev.plan))}>
                                {planLabel(ev.plan)}
                              </span>
                              <div className="relative">
                                {updatingEventPlanId === ev.event_id ? (
                                  <Loader2 size={14} className="animate-spin text-muted" />
                                ) : (
                                  <select
                                    value={ev.plan}
                                    onChange={e => changeEventPlan(user.user_id, ev.event_id, e.target.value as UserPlan)}
                                    className="appearance-none bg-white/5 border border-game-border rounded-lg px-2 py-1 text-xs text-foreground cursor-pointer hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    dir="rtl"
                                  >
                                    {PLAN_OPTIONS.map(p => (
                                      <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
          </>
        )
      )}

      {tab === 'upgrade-requests' && (
        loadingRequests ? (
          <FullPageLoader />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={32} />}
            title="אין פניות הפעלה"
            description="פניות חדשות להפעלת אירוע יופיעו כאן"
          />
        ) : (
          <>
            <SectionHeader
              icon={<MessageSquare size={18} className="text-accent" />}
              title={`${requests.length} פניות הפעלה${newRequestCount > 0 ? ` (${newRequestCount} חדשות)` : ''}`}
              className="mb-6"
            />

            <div className="space-y-3">
              {requests.map(req => {
                const statusOption = STATUS_OPTIONS.find(s => s.value === req.status) || STATUS_OPTIONS[0]
                return (
                  <Card key={req.id} className={cn('p-4', req.status === 'new' && 'border-warning')}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{req.full_name}</span>
                          <AdminStatusPill status={req.status} label={statusOption.label} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span dir="ltr">{req.email}</span>
                          <span dir="ltr">{req.phone}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span>תוכנית: <span className="text-foreground">{LIMIT_LABELS[req.limit_type] || req.limit_type}</span></span>
                          <span>{new Date(req.created_at).toLocaleDateString('he-IL')} {new Date(req.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {req.event_id && (
                          <p className="text-xs text-gray-500">
                            אירוע:{' '}
                            <span className="text-gray-400">
                              {req.events?.name?.trim() || 'ללא שם'}
                            </span>
                          </p>
                        )}
                        {req.notes && (
                          <p className="text-xs text-muted bg-surface-elevated rounded-lg px-3 py-2 mt-1">{req.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {req.event_id && LIMIT_TYPE_TO_PLAN[req.limit_type] && (
                          req.status === 'closed' ? (
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
                              <CheckCircle size={16} />
                              הופעל
                            </span>
                          ) : (
                            <Button
                              variant="gradient"
                              size="sm"
                              loading={upgradingEventId === req.id}
                              onClick={() => upgradeEventPlan(req.id, req.event_id!, LIMIT_TYPE_TO_PLAN[req.limit_type])}
                            >
                              הפעל אירוע
                            </Button>
                          )
                        )}
                        <button
                          onClick={() => { setDeleteRequestError(null); setDeleteRequestTarget(req) }}
                          title="מחק פנייה"
                          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                        >
                          <Trash2 size={14} />
                          מחק
                        </button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )
      )}

      {tab === 'analytics' && <AdminAnalyticsDashboard />}

      {detailEvent && (
        <EventDetailsModal
          eventId={detailEvent.id}
          eventName={detailEvent.name}
          onClose={() => setDetailEvent(null)}
        />
      )}

      <TrialActivationResetModal
        isOpen={pendingPlanChange !== null}
        onClose={() => { if (!activatingPlan) setPendingPlanChange(null) }}
        onContinue={() => void confirmPendingPlanChange()}
        loading={activatingPlan}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="מחיקת משתמש"
        confirmLabel="מחק לצמיתות"
        onConfirm={deleteUser}
        loading={deletingUser}
      >
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-foreground">
            האם אתה בטוח שאתה רוצה למחוק את{' '}
            {deleteTarget?.display_name || deleteTarget?.email}?
          </p>
          <p className="text-muted">
            מחיקה תגרום לכל המידע של הלקוח להימחק — כל האירועים שלו
            {deleteTarget && deleteTarget.event_count > 0 && <> ({deleteTarget.event_count})</>}, כולל
            המשתתפים, הקבוצות, המשימות, הניקוד והפרסים. לא ניתן לשחזר.
          </p>
          {deleteError && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-danger">
              שגיאה במחיקה: {deleteError}
            </p>
          )}
        </div>
      </ConfirmModal>

      <ConfirmModal
        isOpen={deleteRequestTarget !== null}
        onClose={() => setDeleteRequestTarget(null)}
        title="מחיקת פניית הפעלה"
        confirmLabel="מחק פנייה"
        onConfirm={deleteRequest}
        loading={deletingRequest}
      >
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-foreground">
            האם אתה בטוח שאתה רוצה למחוק את הפנייה של{' '}
            {deleteRequestTarget?.full_name || deleteRequestTarget?.email}?
          </p>
          <p className="text-muted">
            הפנייה תימחק לצמיתות ולא ניתן יהיה לשחזר אותה.
          </p>
          {deleteRequestError && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-danger">
              שגיאה במחיקה: {deleteRequestError}
            </p>
          )}
        </div>
      </ConfirmModal>
    </main>
  )
}
