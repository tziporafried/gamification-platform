import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Crown, Users, ListTodo, MessageSquare, Sparkles, ChevronDown, Loader2, Trash2, BarChart3, Calendar, Wallet, CalendarDays, Download, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { exportOfflineGame, OfflineExportError } from '@/lib/offline/exportGame'
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
import { AffiliateFilterBar } from '@/components/admin/analytics/AffiliateFilter'
import { useUtmLinkLabels, affiliateGroupKey, expandAffiliateSelection } from '@/components/admin/analytics/useUtmLinkLabels'
import { AdminEventsList } from '@/components/admin/AdminEventsList'
import { AdminFinancePanel } from '@/components/admin/AdminFinancePanel'
import { AdminScannersPanel } from '@/components/admin/AdminScannersPanel'
import { EventDetailsModal } from '@/components/admin/EventDetailsModal'
import { TrialActivationResetModal } from '@/components/TrialActivationResetModal'
import { trackTrialActivated, trackTrialDataReset } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import type { UserPlan } from '@/types'

type AdminTab = 'todos' | 'customers' | 'upgrade-requests' | 'templates' | 'analytics' | 'events' | 'finance' | 'scanners'

const DEFAULT_ADMIN_TAB: AdminTab = 'analytics'

/** Usage-first order; development todos last. */
const TABS: { id: AdminTab; label: string; icon: typeof ListTodo }[] = [
  { id: 'analytics', label: 'אנליטיקות', icon: BarChart3 },
  { id: 'upgrade-requests', label: 'לידים', icon: MessageSquare },
  { id: 'customers', label: 'לקוחות', icon: Users },
  { id: 'events', label: 'אירועים', icon: Calendar },
  { id: 'scanners', label: 'לוח הזמנות', icon: CalendarDays },
  { id: 'finance', label: 'הכנסות והוצאות', icon: Wallet },
  { id: 'templates', label: 'תבניות', icon: Sparkles },
  { id: 'todos', label: 'משימות פיתוח', icon: ListTodo },
]

function isAdminTab(value: string | undefined): value is AdminTab {
  return TABS.some((t) => t.id === value)
}

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
  affiliate_attribution: Record<string, string> | null
}

function asAffiliateAttr(raw: unknown): Record<string, string> | null {
  if (!raw) return null
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object') return null
  const record = obj as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const) {
    const val = record[key]
    if (typeof val === 'string' && val.trim()) out[key] = val.trim()
  }
  return Object.keys(out).length ? out : null
}

/** Sentinel for profiles with attribution but no usable affiliate code. */
const AFFILIATE_NO_CONTENT = '__no_content__'

/** Generic utm_source values that are not affiliate codes. */
const GENERIC_UTM_SOURCES = new Set(['share', 'personal_share', 'direct', '(direct)'])

/**
 * Affiliate code for filter/display: prefer utm_content, else utm_source
 * when it looks like a mistaken short code (e.g. ?utm_source=bt).
 */
function affiliateFilterCode(attr: unknown): string | null {
  const parsed = asAffiliateAttr(attr)
  if (!parsed) return null
  const content = parsed.utm_content?.trim().toLowerCase()
  if (content) return content
  const source = parsed.utm_source?.trim().toLowerCase()
  if (source && !GENERIC_UTM_SOURCES.has(source)) return source
  if (Object.keys(parsed).length > 0) return AFFILIATE_NO_CONTENT
  return null
}

function affiliateLabel(attr: unknown, labelFor: (code: string) => string | null): string | null {
  const code = affiliateFilterCode(attr)
  if (!code) return null
  if (code === AFFILIATE_NO_CONTENT) {
    const parsed = asAffiliateAttr(attr)
    if (parsed?.utm_source) return `מקור: ${parsed.utm_source}`
    return 'אפיליאייט (ללא קוד לינק)'
  }
  return labelFor(code) ?? code
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
  'plan-full': 'משחק מלא',
  'plan-offline': 'חוויה בלי חיבור לאינטרנט',
  'plan-organizations': 'פתרון לארגונים',
  homepage_contact: 'פנייה כללית (דף הבית)',
  trial_contact: 'פנייה כללית (התנסות)',
}

const PLAN_OPTIONS: { value: UserPlan; label: string; color: string }[] = [
  { value: 'free',          label: 'התנסות',    color: 'text-gray-400' },
  { value: 'independent',   label: 'עצמאי',      color: 'text-blue-400' },
  { value: 'full',          label: 'מלא',        color: 'text-green-400' },
  { value: 'offline',       label: 'ללא אינטרנט', color: 'text-teal-400' },
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
  const { tab: tabParam } = useParams<{ tab: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const { labelFor, labelsByCode } = useUtmLinkLabels()
  const tab: AdminTab = isAdminTab(tabParam) ? tabParam : DEFAULT_ADMIN_TAB
  const [users, setUsers] = useState<AdminUser[]>([])
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [requestsLoaded, setRequestsLoaded] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [newRequestCount, setNewRequestCount] = useState(0)
  const [exportingRequestId, setExportingRequestId] = useState<string | null>(null)
  const [offlineExportError, setOfflineExportError] = useState<{ requestId: string; message: string } | null>(null)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [selectedAffiliates, setSelectedAffiliates] = useState<string[]>([])
  const [customerSearch, setCustomerSearch] = useState('')

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
    userId: string
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
    if (!isAdminTab(tabParam)) {
      navigate(`/admin/${DEFAULT_ADMIN_TAB}`, { replace: true })
    }
  }, [tabParam, navigate])

  useEffect(() => {
    if (tab === 'customers' && !usersLoaded) fetchUsers()
    if (tab === 'upgrade-requests' && !requestsLoaded) fetchRequests()
  }, [tab, usersLoaded, requestsLoaded, fetchUsers, fetchRequests])

  function setTab(next: AdminTab) {
    if (next === tab) return
    navigate(`/admin/${next}`)
  }

  const affiliateOptions = useMemo(() => {
    type Group = { count: number; name: string; codes: string[] }
    const groups = new Map<string, Group>()
    for (const user of users) {
      const code = affiliateFilterCode(user.affiliate_attribution)
      if (!code) continue
      const groupKey =
        code === AFFILIATE_NO_CONTENT ? code : affiliateGroupKey(code, labelFor(code))
      const existing = groups.get(groupKey)
      if (existing) {
        existing.count += 1
        if (code !== AFFILIATE_NO_CONTENT && !existing.codes.includes(code)) {
          existing.codes.push(code)
        }
        continue
      }
      groups.set(groupKey, {
        count: 1,
        name:
          code === AFFILIATE_NO_CONTENT
            ? 'ללא קוד לינק'
            : labelFor(code) ?? code,
        codes: code === AFFILIATE_NO_CONTENT ? [] : [code],
      })
    }
    return [...groups.entries()]
      .filter(([, g]) => g.count > 0)
      .sort((a, b) => {
        if (a[0] === AFFILIATE_NO_CONTENT) return 1
        if (b[0] === AFFILIATE_NO_CONTENT) return -1
        if (b[1].count !== a[1].count) return b[1].count - a[1].count
        return a[1].name.localeCompare(b[1].name, 'he')
      })
      .map(([groupKey, g]) => ({
        code: groupKey,
        name:
          groupKey === AFFILIATE_NO_CONTENT
            ? `ללא קוד לינק (${g.count})`
            : g.name,
        codes: g.codes.sort((x, y) => x.localeCompare(y)),
      }))
  }, [users, labelFor])

  const filteredUsers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    let list = users

    if (selectedAffiliates.length > 0) {
      const codeSet = new Set(expandAffiliateSelection(selectedAffiliates, labelsByCode))
      const includeNoContent = selectedAffiliates.includes(AFFILIATE_NO_CONTENT)
      list = list.filter((user) => {
        const code = affiliateFilterCode(user.affiliate_attribution)
        if (!code) return false
        if (code === AFFILIATE_NO_CONTENT) return includeNoContent
        return codeSet.has(code)
      })
    }

    if (!q) return list
    return list.filter((user) => {
      const email = user.email.toLowerCase()
      const name = (user.display_name ?? '').toLowerCase()
      return email.includes(q) || name.includes(q)
    })
  }, [users, selectedAffiliates, labelsByCode, customerSearch])

  const customersFiltered =
    selectedAffiliates.length > 0 || customerSearch.trim().length > 0

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
    opts?: { userId?: string },
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
      setPendingPlanChange({ userId, eventId, previousPlan, newPlan })
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

  // The offline plan has no self-service download — the file is built here and
  // sent to the customer by hand.
  async function downloadOfflineGame(requestId: string, eventId: string) {
    setOfflineExportError(null)
    setExportingRequestId(requestId)
    try {
      await exportOfflineGame(eventId)
    } catch (err) {
      setOfflineExportError({
        requestId,
        message: err instanceof OfflineExportError ? err.message : 'ההורדה נכשלה. נסו שוב.',
      })
    } finally {
      setExportingRequestId(null)
    }
  }

  async function confirmPendingPlanChange() {
    if (!pendingPlanChange) return
    setActivatingPlan(true)
    const { userId, eventId, newPlan } = pendingPlanChange
    setUpdatingEventPlanId(eventId)
    await applyEventPlanChange(eventId, newPlan, { userId })
    setUpdatingEventPlanId(null)
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
          <div className="mb-4 flex items-center gap-2">
            <Users size={18} className="text-gray-400" />
            <h2 className="text-sm font-medium text-gray-400">
              {customersFiltered
                ? `${filteredUsers.length} מתוך ${users.length} משתמשים`
                : `${users.length} משתמשים רשומים`}
            </h2>
          </div>

          <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3" dir="rtl">
              <div className="relative w-full min-w-[14rem] flex-1 sm:max-w-xs sm:flex-none">
                <Search
                  size={15}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="חיפוש לפי שם או אימייל..."
                  aria-label="חיפוש לקוחות לפי שם או אימייל"
                  className="w-full rounded-xl border border-border bg-background py-2 pe-3 ps-9 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              {affiliateOptions.length > 0 && (
                <div className="min-w-0 flex-1">
                  <AffiliateFilterBar
                    options={affiliateOptions}
                    selected={selectedAffiliates}
                    onChange={setSelectedAffiliates}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <EmptyState
                compact
                icon={<Users size={22} />}
                title="אין לקוחות בסינון הזה"
                description={
                  customerSearch.trim()
                    ? 'נסו חיפוש אחר, או נקו את הסינון.'
                    : 'נסו לבחור אפיליאייט אחר או לנקות את הסינון.'
                }
              />
            ) : null}
            {filteredUsers.map(user => {
              const isExpanded = expandedUsers.has(user.user_id)
              const isLoadingEvents = loadingEventsFor.has(user.user_id)
              const events = userEvents.get(user.user_id) ?? []
              const contentCode = affiliateFilterCode(user.affiliate_attribution)
              const affiliate = affiliateLabel(user.affiliate_attribution, labelFor)

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
                        {affiliate && (
                          <p
                            className="text-xs text-brand-400 mt-0.5 truncate"
                            title={
                              contentCode && contentCode !== AFFILIATE_NO_CONTENT
                                ? `אפיליאייט · ${contentCode}`
                                : 'אפיליאייט נשמר בלי קוד לינק מזוהה'
                            }
                          >
                            אפיליאייט: {affiliate}
                          </p>
                        )}
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
            title="אין לידים"
            description="לידים חדשים יופיעו כאן"
          />
        ) : (
          <>
            <SectionHeader
              icon={<MessageSquare size={18} className="text-accent" />}
              title={`${requests.length} לידים${newRequestCount > 0 ? ` (${newRequestCount} חדשים)` : ''}`}
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
                        {req.event_id && req.limit_type === 'plan-offline' && (
                          <Button
                            variant="outline"
                            size="sm"
                            loading={exportingRequestId === req.id}
                            onClick={() => downloadOfflineGame(req.id, req.event_id!)}
                            title="הורידו את קובץ המשחק ושלחו אותו ללקוח"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Download size={14} />
                              הורד קובץ אופליין
                            </span>
                          </Button>
                        )}
                        {offlineExportError?.requestId === req.id && (
                          <p role="alert" className="max-w-[13rem] text-end text-xs font-semibold text-danger">
                            {offlineExportError.message}
                          </p>
                        )}
                        <button
                          onClick={() => { setDeleteRequestError(null); setDeleteRequestTarget(req) }}
                          title="מחק ליד"
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
        title="מחיקת ליד"
        confirmLabel="מחק ליד"
        onConfirm={deleteRequest}
        loading={deletingRequest}
      >
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-foreground">
            האם אתה בטוח שאתה רוצה למחוק את הליד של{' '}
            {deleteRequestTarget?.full_name || deleteRequestTarget?.email}?
          </p>
          <p className="text-muted">
            הליד יימחק לצמיתות ולא ניתן יהיה לשחזר אותו.
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
