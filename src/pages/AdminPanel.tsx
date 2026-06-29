import { useState, useEffect, useCallback } from 'react'
import { Crown, Users, ListTodo, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { DevTodoList } from '@/components/dev-todos/DevTodoList'
import { cn } from '@/lib/utils'

type AdminTab = 'todos' | 'customers' | 'upgrade-requests'

const TABS: { id: AdminTab; label: string; icon: typeof ListTodo }[] = [
  { id: 'todos', label: 'משימות פיתוח', icon: ListTodo },
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
  { value: 'new', label: 'חדש', color: 'text-amber-400 bg-amber-400/10' },
  { value: 'contacted', label: 'נוצר קשר', color: 'text-blue-400 bg-blue-400/10' },
  { value: 'closed', label: 'נסגר', color: 'text-gray-400 bg-gray-400/10' },
]

const PLAN_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'free', label: 'חינמי', color: 'text-gray-400 bg-gray-400/10' },
  { value: 'independent', label: 'עצמאי', color: 'text-blue-400 bg-blue-400/10' },
  { value: 'full', label: 'מלא', color: 'text-brand-400 bg-brand-400/10' },
  { value: 'organizations', label: 'ארגוני', color: 'text-amber-400 bg-amber-400/10' },
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
  const [tab, setTab] = useState<AdminTab>('todos')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_all_users_admin')
    if (!error && data) setUsers(data as AdminUser[])
    setLoading(false)
  }, [])

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('contact_upgrade_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setRequests(data as UpgradeRequest[])
  }, [])

  useEffect(() => { fetchUsers(); fetchRequests() }, [fetchUsers, fetchRequests])

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
    }
    setUpdatingRequestId(null)
  }

  const newRequestCount = requests.filter(r => r.status === 'new').length

  if (loading) return <FullPageLoader />

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-game-border mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === id
                ? 'border-brand-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300',
            )}
          >
            <Icon size={16} />
            {label}
            {id === 'upgrade-requests' && newRequestCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {newRequestCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'todos' && <DevTodoList />}

      {tab === 'customers' && (
        <>
          <div className="flex items-center gap-2 mb-6">
            <Users size={18} className="text-gray-400" />
            <h2 className="text-sm font-medium text-gray-400">
              {users.length} משתמשים רשומים
            </h2>
          </div>

          <div className="space-y-3">
            {users.map(user => (
              <Card key={user.user_id} className="p-4">
                <div className="flex items-center justify-between gap-4">
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
                        <span className="text-sm font-medium text-white truncate">
                          {user.display_name || user.email.split('@')[0]}
                        </span>
                        {user.role === 'super_admin' && (
                          <Crown size={14} className="text-amber-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        הצטרף {new Date(user.created_at).toLocaleDateString('he-IL')}
                        {user.event_count > 0 && <> · {user.event_count} אירועים</>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {(() => {
                      const planOpt = PLAN_OPTIONS.find(p => p.value === user.plan) || PLAN_OPTIONS[0]
                      return (
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', planOpt.color)}>
                          {planOpt.label}
                        </span>
                      )
                    })()}
                    <select
                      value={user.plan}
                      disabled={updatingId === user.user_id}
                      onChange={e => updatePlan(user.user_id, e.target.value)}
                      className="rounded-lg border border-game-border bg-game-dark px-2 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none disabled:opacity-50"
                    >
                      {PLAN_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === 'upgrade-requests' && (
        <>
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare size={18} className="text-gray-400" />
            <h2 className="text-sm font-medium text-gray-400">
              {requests.length} פניות שדרוג
              {newRequestCount > 0 && <span className="mr-2 text-amber-400">({newRequestCount} חדשות)</span>}
            </h2>
          </div>

          {requests.length === 0 ? (
            <div className="rounded-2xl border border-game-border bg-game-card/50 p-12 text-center">
              <MessageSquare size={32} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm text-gray-500">אין פניות שדרוג עדיין</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => {
                const statusOption = STATUS_OPTIONS.find(s => s.value === req.status) || STATUS_OPTIONS[0]
                return (
                  <Card key={req.id} className={cn('p-4', req.status === 'new' && 'border-amber-500/20')}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{req.full_name}</span>
                          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', statusOption.color)}>
                            {statusOption.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span dir="ltr">{req.email}</span>
                          <span dir="ltr">{req.phone}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>מגבלה: <span className="text-gray-300">{LIMIT_LABELS[req.limit_type] || req.limit_type}</span></span>
                          <span>{new Date(req.created_at).toLocaleDateString('he-IL')} {new Date(req.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {req.notes && (
                          <p className="text-xs text-gray-400 bg-white/[0.03] rounded-lg px-3 py-2 mt-1">{req.notes}</p>
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
          )}
        </>
      )}
    </main>
  )
}
