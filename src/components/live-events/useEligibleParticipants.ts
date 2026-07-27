import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ParticipantLeaderboardEntry } from '@/types'
import type { EligibleParticipant } from './types'
import {
  filterEligible,
  type EligibilityCriteria,
  type GroupMembership,
} from './lottery/lotteryEligibility'

/**
 * The leaderboard, filtered down to whoever the organizer chose.
 *
 * Every points-based way of choosing - everyone, a points line, a set of
 * groups - is the same read followed by a different filter, so switching
 * between them costs nothing and re-reads nothing. The rules themselves live
 * in lottery/lotteryEligibility, where they can be tested without a database.
 *
 * The scan lottery does not come through here at all: its pool is counted in
 * the database from the scans inside the round's window.
 */

interface UseEligibleParticipantsOptions {
  eventId: string
  criteria: EligibilityCriteria
  /** Group membership, needed only when choosing by groups. */
  membership?: GroupMembership
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

const NO_MEMBERSHIP: GroupMembership = new Map()

export function useEligibleParticipants({
  eventId,
  criteria,
  membership = NO_MEMBERSHIP,
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
    () => filterEligible(rows, criteria, membership, excludeIds),
    [rows, criteria, membership, excludeIds],
  )

  return {
    participants,
    count: participants.length,
    loading,
    error,
    refresh,
  }
}
