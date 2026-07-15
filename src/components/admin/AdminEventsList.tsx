import { useCallback, useEffect, useState } from 'react'
import { Calendar, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchTemplateDraftEventIds } from '@/lib/templates'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { StatusBadge, STATUS_COLORS, PLAN_BADGE_COLORS } from '@/components/ui/StatusBadge'
import { EventDetailsModal } from '@/components/admin/EventDetailsModal'
import { cn } from '@/lib/utils'
import type { EventStatus, UserPlan } from '@/types'

interface AdminEventRow {
  id: string
  name: string
  plan: UserPlan
  status: EventStatus
  created_at: string
  owner_admin_id: string
  owner_name: string
  owner_email: string
}

const STATUS_LABELS: Record<string, string> = {
  editing: 'בעריכה',
  active: 'פעיל',
  archived: 'בארכיון',
}

const PLAN_LABELS: Record<string, string> = {
  free: 'התנסות',
  independent: 'עצמאי',
  full: 'מלא',
  organizations: 'ארגונים',
}

function ownerDisplayName(displayName: string | null, email: string) {
  return displayName?.trim() || email.split('@')[0] || email
}

export function AdminEventsList() {
  const [events, setEvents] = useState<AdminEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AdminEventRow | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [eventsRes, draftIds] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, plan, status, created_at, owner_admin_id')
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

    let profileMap = new Map<string, { display_name: string | null; email: string }>()
    if (ownerIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, email')
        .in('id', ownerIds)

      if (profilesError) {
        setError(profilesError.message)
        setEvents([])
        setLoading(false)
        return
      }

      profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, { display_name: p.display_name, email: p.email }]),
      )
    }

    setEvents(
      rows.map((row) => {
        const profile = profileMap.get(row.owner_admin_id)
        const email = profile?.email ?? ''
        return {
          id: row.id,
          name: row.name,
          plan: row.plan as UserPlan,
          status: row.status as EventStatus,
          created_at: row.created_at,
          owner_admin_id: row.owner_admin_id,
          owner_name: profile ? ownerDisplayName(profile.display_name, email) : 'משתמש לא ידוע',
          owner_email: email,
        }
      }),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  if (loading) return <FullPageLoader />

  return (
    <>
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          שגיאה בטעינת אירועים: {error}
        </div>
      )}

      <div className="mb-6 flex items-center gap-2">
        <Calendar size={18} className="text-gray-400" />
        <h2 className="text-sm font-medium text-gray-400">
          {events.length} אירועים
        </h2>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<Calendar size={32} />}
          title="אין אירועים"
          description="אירועים שנוצרו על ידי לקוחות יופיעו כאן"
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-game-border bg-white/[0.02] text-xs text-muted">
                  <th className="px-4 py-3 text-right font-medium">שם האירוע</th>
                  <th className="px-4 py-3 text-right font-medium">משתמש</th>
                  <th className="px-4 py-3 text-right font-medium">תוכנית</th>
                  <th className="px-4 py-3 text-right font-medium">סטטוס</th>
                  <th className="px-4 py-3 text-right font-medium">נוצר</th>
                  <th className="px-4 py-3 text-right font-medium">פרטים</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-game-border/50">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">
                        {event.name?.trim() || (
                          <span className="italic text-muted">ללא שם</span>
                        )}
                      </span>
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
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={STATUS_LABELS[event.status] ?? event.status}
                        color={STATUS_COLORS[event.status as keyof typeof STATUS_COLORS] ?? 'var(--color-muted)'}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {new Date(event.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setPreview(event)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
                          'text-muted transition-colors hover:bg-white/5 hover:text-foreground',
                        )}
                      >
                        <Eye size={14} />
                        צפייה
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
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}
