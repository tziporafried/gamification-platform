import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Crown, Users, ListTodo, MessageSquare, Sparkles, ChevronDown, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { AdminStatusPill } from '@/components/ui/StatusBadge'
import { DevTodoList } from '@/components/dev-todos/DevTodoList'
import { TemplateAdminList } from '@/components/admin/TemplateAdminList'
import { cn } from '@/lib/utils'
import type { UserPlan } from '@/types'

type AdminTab = 'todos' | 'customers' | 'upgrade-requests' | 'templates'

const TABS: { id: AdminTab; label: string; icon: typeof ListTodo }[] = [
  { id: 'todos', label: 'משימות פיתוח', icon: ListTodo },
  { id: 'templates', label: 'תבניות', icon: Sparkles },
  { id: 'customers', label: 'לקוחות', icon: Users },
  { id: 'upgrade-requests', label: 'פניות שדרוג', icon: MessageSquare },
]

interface AdminUser {
  user_id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role: string
  created_at: string
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
}

const LIMIT_TYPE_TO_PLAN: Record<string, string> = {
  'plan-independent': 'independent',
  'plan-full': 'full',
  'plan-organizations': 'organizations',
}

const PLAN_OPTIONS: { value: UserPlan; label: string; color: string }[] = [
  { value: 'free',          label: 'חינמי',      color: 'text-gray-400' },
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

export function AdminPanel() {
  const location = useLocation()
  const [tab, setTab] = useState<AdminTab>('todos')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [requestsLoaded, setRequestsLoaded] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [newRequestCount, setNewRequestCount] = useState(0)
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null)
  const [upgradingEventId, setUpgradingEventId] = useState<string | null>(null)
  const [usersError, setUsersError] = useState<string | null>(null)

  // Per-user event expansion state
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [loadingEventsFor, setLoadingEventsFor] = useState<Set<string>>(new Set())
  const [userEvents, setUserEvents] = useState<Map<string, AdminEventRow[]>>(new Map())
  const [updatingEventPlanId, setUpdatingEventPlanId] = useState<string | null>(null)

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
      .select('*')
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

  async function changeEventPlan(userId: string, eventId: string, newPlan: UserPlan) {
    setUpdatingEventPlanId(eventId)
    const { error } = await supabase.rpc('update_event_plan', {
      p_event_id: eventId,
      p_new_plan: newPlan,
    })
    if (!error) {
      setUserEvents(prev => {
        const events = prev.get(userId)
        if (!events) return prev
        return new Map(prev).set(
          userId,
          events.map(e => e.event_id === eventId ? { ...e, plan: newPlan } : e)
        )
      })
    }
    setUpdatingEventPlanId(null)
  }

  async function upgradeEventPlan(requestId: string, eventId: string, newPlan: string) {
    setUpgradingEventId(requestId)
    const { error } = await supabase.rpc('update_event_plan', {
      p_event_id: eventId,
      p_new_plan: newPlan,
    })
    if (!error) {
      await updateRequestStatus(requestId, 'closed')
    }
    setUpgradingEventId(null)
  }

  async function updateRequestStatus(requestId: string, newStatus: string) {
    setUpdatingRequestId(requestId)
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
    setUpdatingRequestId(null)
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
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
                      </div>
                    </div>

                    {user.event_count > 0 && (
                      <button
                        onClick={() => toggleUserEvents(user.user_id)}
                        className="flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-white/5 hover:text-foreground transition-colors"
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
                  </div>

                  {isExpanded && (
                    <div className="border-t border-game-border divide-y divide-game-border/50">
                      {events.length === 0 && !isLoadingEvents ? (
                        <p className="px-4 py-3 text-xs text-muted text-center">אין אירועים פעילים</p>
                      ) : (
                        events.map(ev => (
                          <div key={ev.event_id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                            <span className="text-sm text-foreground truncate flex-1">
                              {ev.event_name || <span className="text-muted italic">ללא שם</span>}
                            </span>
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
            title="אין פניות שדרוג"
            description="פניות שדרוג חדשות יופיעו כאן"
          />
        ) : (
          <>
            <SectionHeader
              icon={<MessageSquare size={18} className="text-accent" />}
              title={`${requests.length} פניות שדרוג${newRequestCount > 0 ? ` (${newRequestCount} חדשות)` : ''}`}
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
                          <p className="text-xs text-gray-500">אירוע: <span className="font-mono text-gray-400">{req.event_id}</span></p>
                        )}
                        {req.notes && (
                          <p className="text-xs text-muted bg-surface-elevated rounded-lg px-3 py-2 mt-1">{req.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {req.event_id && LIMIT_TYPE_TO_PLAN[req.limit_type] && req.status !== 'closed' && (
                          <Button
                            variant="gradient"
                            size="sm"
                            loading={upgradingEventId === req.id}
                            onClick={() => upgradeEventPlan(req.id, req.event_id!, LIMIT_TYPE_TO_PLAN[req.limit_type])}
                          >
                            שדרג אירוע
                          </Button>
                        )}
                        <div className="flex items-center gap-2">
                          {STATUS_OPTIONS.filter(s => s.value !== req.status).map(s => (
                            <Button
                              key={s.value}
                              variant="outline"
                              size="sm"
                              loading={updatingRequestId === req.id}
                              onClick={() => updateRequestStatus(req.id, s.value)}
                            >
                              {s.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )
      )}
    </main>
  )
}
