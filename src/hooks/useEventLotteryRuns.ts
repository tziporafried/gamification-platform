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

/** One name the lottery landed on. */
export interface LotteryWinner {
  name: string
  participantId: string | null
  drawnAt: string
}

/**
 * One lottery, with every winner it produced.
 *
 * The table stores a row per *draw*, because a redraw is a real event worth
 * keeping. But a manager reading the history wants the lottery: one prize, one
 * pool, and the list of names it came out on - not four near-identical rows
 * that only draw_index tells apart. Grouping happens here so the tab renders
 * what it is handed.
 */
export interface LotteryRun {
  /** The run id, or the draw's own id for a draw recorded before run ids. */
  id: string
  prizeName: string
  prizeIcon: string | null
  eligibilityMode: LotteryEligibilityMode
  minPoints: number | null
  poolLabel: string | null
  /** The pool the lottery opened on - the first draw's, before any exclusion. */
  entrantCount: number
  entrants: LotteryDrawEntrant[]
  /** In the order they were drawn. */
  winners: LotteryWinner[]
  /** When the lottery ran, i.e. its first draw. */
  drawnAt: string
}

interface LotteryDraw {
  id: string
  runId: string | null
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
  /** Absent when read from a schema that predates the column. */
  run_id?: string | null
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

interface QueryError {
  code?: string
  message?: string
}

/**
 * The table itself is absent - the migration has never run. That is "no
 * lotteries yet", not an error to put in front of the operator.
 *
 * 42P01 is postgres' undefined_table; PGRST205 is PostgREST failing to find it
 * in its schema cache.
 */
function isMissingTable(error: QueryError): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const message = error.message ?? ''
  // Narrowed to the table's own wording. A column error mentions the table
  // too, and reading it as "no lotteries yet" is exactly how a schema that had
  // fallen a migration behind came out looking like an empty history.
  return message.includes('lottery_draws') && message.includes('relation')
}

/**
 * The table is there but a column this build asks for is not - the schema is a
 * migration behind. Recoverable: everything except that column still exists,
 * so the read is retried without it rather than reported as nothing.
 *
 * 42703 is undefined_column; PGRST204 is PostgREST's version.
 */
function isMissingColumn(error: QueryError): boolean {
  if (error.code === '42703' || error.code === 'PGRST204') return true
  const message = error.message ?? ''
  return message.includes('column') && message.includes('does not exist')
}

const COLUMNS =
  'id, run_id, prize_name, prize_icon, eligibility_mode, min_points, pool_label, entrant_count,' +
  ' winner_name, winner_participant_id, draw_index, drawn_at,' +
  ' entrants:lottery_draw_entrants(participant_id, participant_name)'

/** The same list without run_id, for a schema that predates the grouping. */
const COLUMNS_WITHOUT_RUN =
  'id, prize_name, prize_icon, eligibility_mode, min_points, pool_label, entrant_count,' +
  ' winner_name, winner_participant_id, draw_index, drawn_at,' +
  ' entrants:lottery_draw_entrants(participant_id, participant_name)'

/**
 * Collapses draws into lotteries.
 *
 * Rows arrive newest first, so each group's *last* draw is its first - that is
 * the one carrying the full pool, before any winner was excluded from it, and
 * the time the lottery actually ran. Winners come back in the order they were
 * drawn.
 *
 * A draw with no run id predates the column and stands alone, which is the
 * same thing it was already doing.
 */
function groupIntoRuns(draws: LotteryDraw[]): LotteryRun[] {
  const runs: LotteryRun[] = []
  const byRun = new Map<string, LotteryRun>()

  for (const draw of draws) {
    const key = draw.runId ?? draw.id
    const existing = byRun.get(key)

    if (existing) {
      // Older than what is already grouped: it opened the lottery.
      existing.winners.unshift({
        name: draw.winnerName,
        participantId: draw.winnerParticipantId,
        drawnAt: draw.drawnAt,
      })
      existing.entrantCount = draw.entrantCount
      existing.entrants = draw.entrants
      existing.drawnAt = draw.drawnAt
      continue
    }

    const run: LotteryRun = {
      id: key,
      prizeName: draw.prizeName,
      prizeIcon: draw.prizeIcon,
      eligibilityMode: draw.eligibilityMode,
      minPoints: draw.minPoints,
      poolLabel: draw.poolLabel,
      entrantCount: draw.entrantCount,
      entrants: draw.entrants,
      winners: [
        { name: draw.winnerName, participantId: draw.winnerParticipantId, drawnAt: draw.drawnAt },
      ],
      drawnAt: draw.drawnAt,
    }
    byRun.set(key, run)
    runs.push(run)
  }

  return runs
}

export function useEventLotteryRuns(eventId: string | undefined) {
  const [draws, setDraws] = useState<LotteryRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId) return
    setError(null)

    const read = (columns: string) =>
      supabase
        .from('lottery_draws')
        .select(columns)
        .eq('event_id', eventId)
        .order('drawn_at', { ascending: false })

    let { data, error: queryError } = await read(COLUMNS)

    // A schema still missing run_id has every lottery this game ever ran; it
    // just cannot group them. Showing the history ungrouped beats showing an
    // operator that their lotteries have vanished.
    if (queryError && isMissingColumn(queryError)) {
      ;({ data, error: queryError } = await read(COLUMNS_WITHOUT_RUN))
    }

    if (queryError) {
      if (isMissingTable(queryError)) {
        setDraws([])
      } else {
        setError('טעינת ההגרלות נכשלה. נסו לרענן את הדף.')
        setDraws([])
      }
      setLoading(false)
      return
    }

    const rows = (data ?? []) as unknown as DrawQueryRow[]
    const parsed: LotteryDraw[] = rows.map((row) => ({
      id: row.id,
      runId: row.run_id ?? null,
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
    }))
    setDraws(groupIntoRuns(parsed))
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  return { runs: draws, loading, error, reload: load }
}
