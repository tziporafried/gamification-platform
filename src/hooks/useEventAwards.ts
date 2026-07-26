import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * The event's award log for the management screen: who won which reward, when.
 *
 * Reads go through supabase, which the offline player aliases to its own shim -
 * so the same screen runs unchanged from an exported file.
 */

export interface EventAward {
  id: string
  participantId: string
  participantName: string
  rewardName: string
  scoreAtAward: number
  awardedAt: string
}

interface AwardQueryRow {
  id: string
  participant_id: string
  score_at_award: number | null
  awarded_at: string
  participant: { name: string } | null
  reward: { name: string } | null
}

export function useEventAwards(eventId: string | undefined) {
  const [awards, setAwards] = useState<EventAward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId) return
    setError(null)

    const { data, error: queryError } = await supabase
      .from('participant_rewards')
      .select('id, participant_id, score_at_award, awarded_at, participant:participants(name), reward:rewards(name)')
      .eq('event_id', eventId)
      .order('awarded_at', { ascending: false })

    if (queryError) {
      setError('טעינת הפרסים נכשלה. נסו לרענן את הדף.')
      setLoading(false)
      return
    }

    const rows = (data ?? []) as unknown as AwardQueryRow[]
    setAwards(
      rows.map((row) => ({
        id: row.id,
        participantId: row.participant_id,
        // A reward or participant deleted after the award still belongs in the
        // log - the prize was handed out either way.
        participantName: row.participant?.name ?? 'משתתף שנמחק',
        rewardName: row.reward?.name ?? 'פרס שנמחק',
        scoreAtAward: row.score_at_award ?? 0,
        awardedAt: row.awarded_at,
      })),
    )
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  return { awards, loading, error, reload: load }
}
