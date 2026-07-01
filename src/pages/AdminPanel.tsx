import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Crown, Users, ListTodo, MessageSquare, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { AdminStatusPill, PLAN_BADGE_COLORS } from '@/components/ui/StatusBadge'
import { DevTodoList } from '@/components/dev-todos/DevTodoList'
import { TemplateAdminList } from '@/components/admin/TemplateAdminList'
import { cn } from '@/lib/utils'

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
  plan: string
  created_at: string
  event_count: number
  event_names: string
}

interface UpgradeRequest {
  id: string
  user_id: string
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

const PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: 'free', label: 'חינמי' },
  { value: 'independent', label: 'עצמאי' },
  { value: 'full', label: 'מלא' },
  { value: 'organizations', label: 'ארגוני' },
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
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    const { data, error } = await supabase.rpc('get_all_users_admin')
    if (!error && data) setUsers(data as AdminUser[])
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

  async function updatePlan(userId: string, newPlan: string) {
    setUpdatingId(userId)
    const { error } = await supabase.rpc('update_user_plan', {
      target_user_id: userId,
      new_plan: newPlan,
    })
    if (!error) {
      setUsers(prev => prev.map(u =>
        u.user_id === userId ? { ...u, plan: newPlan } : u
      ))
    }
    setUpdatingId(null)
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
            <SectionHeader
              icon={<Users size={18} className="text-secondary" />}
              title={`${users.length} משתמשים רשומים`}
              className="mb-6"
            />

            <div className="space-y-3">
              {users.map(user => {
                const planColor = PLAN_BADGE_COLORS[user.plan] ?? PLAN_BADGE_COLORS.free
                const planLabel = PLAN_OPTIONS.find(p => p.value === user.plan)?.label ?? user.plan

                return (
                  <Card key={user.user_id} className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated shrink-0">
                            <span className="text-sm font-bold text-secondary">
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

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: planColor + '18', color: planColor }}
                        >
                          {planLabel}
                        </span>
                        <Select
                          value={user.plan}
                          disabled={updatingId === user.user_id}
                          onChange={e => updatePlan(user.user_id, e.target.value)}
                          className="w-auto py-1.5 text-xs"
                        >
                          {PLAN_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
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
                          <span>מגבלה: <span className="text-foreground">{LIMIT_LABELS[req.limit_type] || req.limit_type}</span></span>
                          <span>{new Date(req.created_at).toLocaleDateString('he-IL')} {new Date(req.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {req.notes && (
                          <p className="text-xs text-muted bg-surface-elevated rounded-lg px-3 py-2 mt-1">{req.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
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
