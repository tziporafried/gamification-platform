import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { GroupMembership } from './lottery/lotteryEligibility'

/**
 * The game's groups, and who is in them.
 *
 * Needed by exactly two of the eligibility choices - "לפי קבוצות", to pick
 * from and to filter by - so it is loaded only when one of them is selected.
 * The leaderboard already carries every player's name and id, which is all the
 * "לפי משתתפים" picker needs, so that choice costs no extra query at all.
 */

export interface LotteryGroup {
  id: string
  name: string
  color: string
}

export interface LotteryRoster {
  groups: LotteryGroup[]
  membership: GroupMembership
  loading: boolean
  error: string | null
  refresh: () => void
}

const NO_GROUPS: LotteryGroup[] = []
const NO_MEMBERSHIP: GroupMembership = new Map()

export function useLotteryRoster(eventId: string, enabled: boolean): LotteryRoster {
  const [groups, setGroups] = useState<LotteryGroup[]>(NO_GROUPS)
  const [membership, setMembership] = useState<GroupMembership>(NO_MEMBERSHIP)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled || !eventId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      const { data: groupRows, error: groupError } = await supabase
        .from('groups')
        .select('id, name, color')
        .eq('event_id', eventId)
        .order('name', { ascending: true })

      if (cancelled) return
      if (groupError) {
        setError('לא ניתן לטעון קבוצות כרגע.')
        setGroups(NO_GROUPS)
        setMembership(NO_MEMBERSHIP)
        setLoading(false)
        return
      }

      const list = (groupRows ?? []) as LotteryGroup[]
      setGroups(list)

      // A game with no groups has no membership to fetch, and the `in ()` below
      // would be an empty filter rather than an empty answer.
      if (list.length === 0) {
        setMembership(NO_MEMBERSHIP)
        setLoading(false)
        return
      }

      // Reached through the group ids rather than the participants, so this
      // stays one indexed lookup (idx_participant_groups_group_id) and never
      // has to enumerate a large roster to find the few who are in a group.
      const { data: linkRows, error: linkError } = await supabase
        .from('participant_groups')
        .select('participant_id, group_id')
        .in(
          'group_id',
          list.map((g) => g.id),
        )

      if (cancelled) return
      if (linkError) {
        setError('לא ניתן לטעון את שיוך הקבוצות כרגע.')
        setMembership(NO_MEMBERSHIP)
        setLoading(false)
        return
      }

      const byParticipant = new Map<string, string[]>()
      for (const row of (linkRows ?? []) as { participant_id: string; group_id: string }[]) {
        const existing = byParticipant.get(row.participant_id)
        if (existing) existing.push(row.group_id)
        else byParticipant.set(row.participant_id, [row.group_id])
      }
      setMembership(byParticipant)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [eventId, enabled, tick])

  return useMemo(
    () => ({ groups, membership, loading, error, refresh }),
    [groups, membership, loading, error, refresh],
  )
}
