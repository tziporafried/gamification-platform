import { useState, useEffect, useCallback } from 'react'
import { Crown, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { cn } from '@/lib/utils'

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

export function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_all_users_admin')
    if (!error && data) setUsers(data as AdminUser[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function togglePlan(userId: string, currentPlan: string) {
    setUpdatingId(userId)
    const newPlan = currentPlan === 'paid' ? 'free' : 'paid'
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

  if (loading) return <FullPageLoader />

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
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
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    user.plan === 'paid'
                      ? 'text-emerald-400 bg-emerald-400/10'
                      : 'text-gray-400 bg-gray-400/10'
                  )}>
                    {user.plan === 'paid' ? 'בתשלום' : 'חינמי'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={updatingId === user.user_id}
                    onClick={() => togglePlan(user.user_id, user.plan)}
                  >
                    {user.plan === 'paid' ? 'הורד לחינמי' : 'שדרג לבתשלום'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
    </main>
  )
}
