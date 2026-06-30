import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { EventCounts } from '@/types'

const COUNT_QUERIES: Record<keyof EventCounts, { table: string }> = {
  participants: { table: 'participants' },
  groups: { table: 'groups' },
  tasks: { table: 'actions' },
  transactions: { table: 'point_transactions' },
  rewards: { table: 'rewards' },
}

const ALL_COUNT_KEYS = Object.keys(COUNT_QUERIES) as (keyof EventCounts)[]

const EMPTY_COUNTS: EventCounts = {
  participants: 0,
  groups: 0,
  tasks: 0,
  transactions: 0,
  rewards: 0,
}

export function useEventCounts(
  eventId: string | undefined,
  countKeys: (keyof EventCounts)[] = ALL_COUNT_KEYS,
) {
  const [counts, setCounts] = useState<EventCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const keys = useMemo(
    () => (countKeys.length > 0 ? countKeys : ALL_COUNT_KEYS),
    [countKeys],
  )

  const patchCounts = useCallback((patch: Partial<EventCounts>) => {
    setCounts((prev) => ({ ...prev, ...patch }))
  }, [])

  const refresh = useCallback(async (overrideKeys?: (keyof EventCounts)[]) => {
    if (!eventId) return

    const fields = overrideKeys ?? keys
    const results = await Promise.all(
      fields.map((key) =>
        supabase
          .from(COUNT_QUERIES[key].table)
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId),
      ),
    )

    const patch = Object.fromEntries(
      fields.map((key, i) => [key, results[i].count ?? 0]),
    ) as Partial<EventCounts>

    setCounts((prev) => ({ ...prev, ...patch }))
    setLoading(false)
    setLoaded(true)
  }, [eventId, keys])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { counts, loading, loaded, refresh, patchCounts }
}
