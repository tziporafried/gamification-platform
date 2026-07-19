import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ParticipantLeaderboardEntry } from '@/types'
import type { EligibleParticipant, LotteryEligibilityMode } from './types'

interface UseEligibleParticipantsOptions {
  eventId: string
  mode: LotteryEligibilityMode
  minPoints: number
  /** Reserved for future filtering against lottery winner history. */
  excludeIds?: ReadonlySet<string>
  enabled?: boolean
}

interface UseEligibleParticipantsResult {
  participants: EligibleParticipant[]
  count: number
  loading: boolean
  error: string | null
  refresh: () => void
}

export function filterEligibleParticipants(
  rows: ParticipantLeaderboardEntry[],
  mode: LotteryEligibilityMode,
  minPoints: number,
  excludeIds?: ReadonlySet<string>,
): EligibleParticipant[] {
  const threshold = mode === 'all' ? 0 : Math.max(0, Math.floor(minPoints))
  return rows
    .filter((row) => {
      if (row.total_points < threshold) return false
      if (excludeIds?.has(row.participant_id)) return false
      return true
    })
    .map((row) => ({
      id: row.participant_id,
      name: row.participant_name,
      points: Number(row.total_points),
    }))
}

export function useEligibleParticipants({
  eventId,
  mode,
  minPoints,
  excludeIds,
  enabled = true,
}: UseEligibleParticipantsOptions): UseEligibleParticipantsResult {
  const [rows, setRows] = useState<ParticipantLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled || !eventId) return

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: rpcError } = await supabase.rpc('get_participant_leaderboard', {
        p_event_id: eventId,
      })
      if (cancelled) return
      if (rpcError) {
        setError('לא ניתן לטעון משתתפים כרגע.')
        setRows([])
        setLoading(false)
        return
      }
      setRows((data ?? []) as ParticipantLeaderboardEntry[])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [eventId, enabled, tick])

  const participants = useMemo(
    () => filterEligibleParticipants(rows, mode, minPoints, excludeIds),
    [rows, mode, minPoints, excludeIds],
  )

  return {
    participants,
    count: participants.length,
    loading,
    error,
    refresh,
  }
}
