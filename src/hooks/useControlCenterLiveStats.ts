import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ControlCenterLiveStats } from '@/types'

const EMPTY_STATS: ControlCenterLiveStats = {
  playersPlayed: 0,
  activityTypesScanned: 0,
  totalScans: 0,
  totalPoints: 0,
  rewardsEarned: 0,
  activeGroups: 0,
}

const POLL_MS = 30_000

async function fetchLiveStats(eventId: string): Promise<ControlCenterLiveStats> {
  const [txRes, rewardsRes] = await Promise.all([
    supabase
      .from('point_transactions')
      .select('participant_id, action_id, points')
      .eq('event_id', eventId),
    supabase
      .from('participant_rewards')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
  ])

  const rows = txRes.data
  if (txRes.error || !rows) return EMPTY_STATS

  const players = new Set<string>()
  const activities = new Set<string>()
  let totalPoints = 0
  for (const row of rows) {
    players.add(row.participant_id)
    activities.add(row.action_id)
    totalPoints += row.points ?? 0
  }

  let activeGroups = 0
  if (players.size > 0) {
    const { data: groupRows } = await supabase
      .from('participant_groups')
      .select('group_id')
      .in('participant_id', [...players])
    activeGroups = new Set((groupRows ?? []).map((row) => row.group_id)).size
  }

  return {
    playersPlayed: players.size,
    activityTypesScanned: activities.size,
    totalScans: rows.length,
    totalPoints,
    rewardsEarned: rewardsRes.count ?? 0,
    activeGroups,
  }
}

export function useControlCenterLiveStats(eventId: string, enabled = true) {
  const [stats, setStats] = useState<ControlCenterLiveStats>(EMPTY_STATS)

  const refresh = useCallback(async () => {
    if (!eventId || !enabled) return
    const next = await fetchLiveStats(eventId)
    setStats(next)
  }, [eventId, enabled])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [refresh, enabled])

  return stats
}
