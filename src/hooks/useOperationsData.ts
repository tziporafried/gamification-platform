import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { computeRanks, getMissionStatus, sortMissionsByUrgency } from '@/lib/missionUtils'
import type { Action, GroupLeaderboardEntry } from '@/types'

export interface TxRow {
  id: string
  participant_id: string
  action_id: string
  points: number
  created_at: string
  participant: { name: string; external_id: string }
  action: { name: string; code: string; points: number }
}

export type RankedGroup = GroupLeaderboardEntry & { rank: number }

export interface OperationsData {
  rankedGroups: RankedGroup[]
  sortedMissions: Action[]
  primaryMission: Action | null
  bonusMissions: Action[]
  transactions: TxRow[]
  todayPoints: number
  secondNow: Date
  loading: boolean
  refresh: () => void
}

export function useOperationsData(eventId: string): OperationsData {
  const [groupData, setGroupData] = useState<GroupLeaderboardEntry[]>([])
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [secondNow, setSecondNow] = useState(new Date())
  const isInitialFetch = useRef(true)

  useEffect(() => { const t = setInterval(() => setSecondNow(new Date()), 1_000); return () => clearInterval(t) }, [])

  const fetchAll = useCallback(async () => {
    try {
      const [gRes, txRes, actRes] = await Promise.all([
        supabase.rpc('get_group_leaderboard', { p_event_id: eventId }),
        supabase
          .from('point_transactions')
          .select('id, participant_id, action_id, points, created_at, participant:participants(name,external_id), action:actions(name,code,points)')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(25),
        supabase.from('actions').select('*').eq('event_id', eventId).eq('is_active', true),
      ])

      const gData = (gRes.data ?? []) as GroupLeaderboardEntry[]
      const newTx = (txRes.data ?? []) as unknown as TxRow[]
      const newActs = (actRes.data ?? []) as Action[]

      setGroupData(prev => {
        if (prev.length !== gData.length) return gData
        for (let i = 0; i < gData.length; i++) {
          if (prev[i]?.group_id !== gData[i]?.group_id || prev[i]?.total_points !== gData[i]?.total_points) return gData
        }
        return prev
      })

      setTransactions(prev => {
        if (prev.length !== newTx.length || prev[0]?.id !== newTx[0]?.id) return newTx
        return prev
      })

      setActions(prev => {
        if (prev.length !== newActs.length) return newActs
        for (let i = 0; i < newActs.length; i++) {
          const o = prev[i], n = newActs[i]
          if (
            o?.id !== n?.id || o?.is_active !== n?.is_active ||
            o?.start_at !== n?.start_at || o?.end_at !== n?.end_at ||
            o?.speed_bonus_enabled !== n?.speed_bonus_enabled
          ) return newActs
        }
        return prev
      })
    } finally {
      if (isInitialFetch.current) {
        setLoading(false)
        isInitialFetch.current = false
      }
    }
  }, [eventId])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const t = setInterval(() => fetchAll(), 30_000)
    return () => clearInterval(t)
  }, [fetchAll])

  const rankedGroups = useMemo(() => computeRanks(groupData), [groupData])

  const sortedMissions = useMemo(() => sortMissionsByUrgency(actions), [actions])

  const primaryMission = useMemo(() => {
    return (
      sortedMissions.find(a => {
        const s = getMissionStatus(a)
        return (s === 'active' || s === 'ending') && a.time_enabled && a.end_at
      }) ??
      sortedMissions.find(a => getMissionStatus(a) === 'upcoming' && a.time_enabled && a.start_at) ??
      sortedMissions[0] ?? null
    )
  }, [sortedMissions])

  const bonusMissions = useMemo(() => sortedMissions.filter(a => a.speed_bonus_enabled), [sortedMissions])

  const todayPoints = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return transactions
      .filter(tx => new Date(tx.created_at) >= today && tx.points > 0)
      .reduce((s, tx) => s + tx.points, 0)
  }, [transactions])

  return {
    rankedGroups,
    sortedMissions,
    primaryMission,
    bonusMissions,
    transactions,
    todayPoints,
    secondNow,
    loading,
    refresh: fetchAll,
  }
}
