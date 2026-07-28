import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LotteryEligibilityMode } from '@/components/live-events/types'

/**
 * The event's lottery history for the management screen: what was drawn, how
 * the pool was chosen, who was in it and who won.
 *
 * The entrants come down with the draws in one read. A draw's pool is the
 * whole point of the record - "who was in the running" is the question the
 * table exists to answer - and it is a handful of rows per draw, so fetching
 * them lazily per row would cost a request to save nothing.
 *
 * Reads go through supabase, which the offline player aliases to its own shim.
 * The offline shim has no lottery_draws, so it returns the missing-table case
 * below and the tab simply reports no lotteries yet.
 */

export interface LotteryDrawEntrant {
  participantId: string | null
  name: string
}

export interface LotteryDraw {
  id: string
  prizeName: string
  prizeIcon: string | null
  eligibilityMode: LotteryEligibilityMode
  minPoints: number | null
  /** The line the audience was shown, e.g. "בוגרים · מתחילים". */
  poolLabel: string | null
  entrantCount: number
  winnerName: string
  winnerParticipantId: string | null
  /** 0 for the first draw for a prize, then one per redraw. */
  drawIndex: number
  drawnAt: string
  entrants: LotteryDrawEntrant[]
}

interface DrawQueryRow {
  id: string
  prize_name: string
  prize_icon: string | null
  eligibility_mode: string
  min_points: number | null
  pool_label: string | null
  entrant_count: number | null
  winner_name: string
  winner_participant_id: string | null
  draw_index: number | null
  drawn_at: string
  entrants: { participant_id: string | null; participant_name: string }[] | null
}

/**
 * True when the read failed because the migration has not run. Same contract
 * as lib/eventFeatures' version: a missing table means "no lotteries yet", not
 * an error to put in front of the operator.
 */
function isMissingTableError(message: string | null | undefined): boolean {
  if (!message) return false
  const missing = message.includes('does not exist') || message.includes('schema cache')
  return missing && message.includes('lottery_draw')
}

export function useEventLotteryDraws(eventId: string | undefined) {
  const [draws, setDraws] = useState<LotteryDraw[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId) return
    setError(null)

    const { data, error: queryError } = await supabase
      .from('lottery_draws')
      .select(
        'id, prize_name, prize_icon, eligibility_mode, min_points, pool_label, entrant_count,' +
          ' winner_name, winner_participant_id, draw_index, drawn_at,' +
          ' entrants:lottery_draw_entrants(participant_id, participant_name)',
      )
      .eq('event_id', eventId)
      .order('drawn_at', { ascending: false })

    if (queryError) {
      if (!isMissingTableError(queryError.message)) {
        setError('טעינת ההגרלות נכשלה. נסו לרענן את הדף.')
      }
      setDraws([])
      setLoading(false)
      return
    }

    const rows = (data ?? []) as unknown as DrawQueryRow[]
    setDraws(
      rows.map((row) => ({
        id: row.id,
        prizeName: row.prize_name,
        prizeIcon: row.prize_icon,
        eligibilityMode: row.eligibility_mode as LotteryEligibilityMode,
        minPoints: row.min_points,
        poolLabel: row.pool_label,
        // The stored count is what the draw actually ran on. Entrant rows can
        // outlive it only by being fewer, never more, so the recorded number
        // is the honest one to show.
        entrantCount: row.entrant_count ?? (row.entrants?.length ?? 0),
        winnerName: row.winner_name,
        winnerParticipantId: row.winner_participant_id,
        drawIndex: row.draw_index ?? 0,
        drawnAt: row.drawn_at,
        entrants: (row.entrants ?? []).map((e) => ({
          participantId: e.participant_id,
          name: e.participant_name,
        })),
      })),
    )
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  return { draws, loading, error, reload: load }
}
