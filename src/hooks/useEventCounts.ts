import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { EventCounts } from '@/types'

export function useEventCounts(eventId: string | undefined) {
  const [counts, setCounts] = useState<EventCounts>({
    participants: 0,
    groups: 0,
    tasks: 0,
    transactions: 0,
    rewards: 0,
  })
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!eventId) return

    const [participantsRes, groupsRes, tasksRes, transactionsRes, rewardsRes] = await Promise.all([
      supabase.from('participants').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('groups').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('actions').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('point_transactions').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('rewards').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    ])

    setCounts({
      participants: participantsRes.count ?? 0,
      groups: groupsRes.count ?? 0,
      tasks: tasksRes.count ?? 0,
      transactions: transactionsRes.count ?? 0,
      rewards: rewardsRes.count ?? 0,
    })
    setLoading(false)
    setLoaded(true)
  }, [eventId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { counts, loading, loaded, refresh }
}
