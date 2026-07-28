import { supabase } from '@/lib/supabase'
import type { EligibleParticipant, LotteryConfig } from '../types'
import { poolDescription } from './lotteryMode'

/**
 * The record of a draw, for whoever runs the programme.
 *
 * Written once, when the winner is revealed, and never touched again - what
 * was given away, how the pool was chosen, who was in the running, and who it
 * landed on. A redraw ("הגרל שוב") writes its own row, because the manager
 * wants both the fact that it happened and each name it produced.
 *
 * This is the one part of the lottery that belongs in the database rather than
 * in localStorage like the rest of it: the collection is one operator on one
 * screen for a few minutes, but a record exists to be read later, by somebody
 * else, from another machine.
 *
 * Recording is best-effort by design. A lottery that has already announced a
 * winner to a room must not then show an error because a write failed, and
 * there is nothing the operator could do about it mid-ceremony. The failure is
 * logged and the show goes on.
 */

export interface LotteryDrawRecord {
  config: LotteryConfig
  /**
   * Ties every draw made without leaving the screen into one lottery, so the
   * history shows a list of winners rather than a stack of near-identical rows.
   */
  runId: string | null
  /** Everyone in the hat for this draw. */
  entrants: readonly EligibleParticipant[]
  winner: { id: string; name: string }
  /** 0 for the first draw of the evening, then one per redraw. */
  drawIndex: number
}

export async function recordLotteryDraw({
  config,
  runId,
  entrants,
  winner,
  drawIndex,
}: LotteryDrawRecord): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('lottery_draws')
      .insert({
        event_id: config.eventId,
        run_id: runId,
        prize_name: config.prizeName,
        prize_icon: config.prizeIcon || null,
        eligibility_mode: config.eligibilityMode,
        min_points: config.eligibilityMode === 'min_points' ? config.minPoints : null,
        group_ids: config.eligibilityMode === 'groups' ? (config.groupIds ?? []) : null,
        // The line the audience was actually shown, so the record reads the
        // way the evening did rather than as a set of ids.
        pool_label: poolDescription(config),
        entrant_count: entrants.length,
        winner_participant_id: winner.id,
        winner_name: winner.name,
        draw_index: drawIndex,
      })
      .select('id')
      .single()

    if (error) throw error

    if (entrants.length > 0) {
      // Names are copied in beside the ids: a participant removed from the
      // game later must not blank out who was in the running that night.
      const { error: entrantsError } = await supabase.from('lottery_draw_entrants').insert(
        entrants.map((p) => ({
          draw_id: (data as { id: string }).id,
          participant_id: p.id,
          participant_name: p.name,
        })),
      )
      if (entrantsError) throw entrantsError
    }
  } catch (err) {
    // See the note above: the winner is already on screen, so this cannot be
    // allowed to surface. It is logged so a missing row can be explained.
    console.warn('[lottery] draw not recorded', err)
  }
}
