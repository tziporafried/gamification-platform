import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isMissingColumn, isMissingTable, type QueryError } from '@/lib/supabaseErrors'
import { fetchAllRows } from '@/lib/supabasePaging'
import { withRanks, type ParticipantRow } from '@/lib/manage/participantsReport'

/**
 * Everything the game knows about its participants, gathered into one row each.
 *
 * Four reads rather than one join: participants with their groups, the scoring
 * log, the awards log, and the lottery winners. Each is a small flat query that
 * the existing hooks already prove out, and stitching them together in memory
 * costs nothing at the sizes involved - a big game is hundreds of participants
 * and a few thousand scans.
 *
 * Two of the four may fail in ways that are not failures. A database that has
 * not run 081/083 has no phone or split-name columns; one that has not run 080
 * has no lottery table at all. Both come back as a narrower row, never as an
 * error - the screen's job is to show what this game has.
 */

interface ParticipantQueryRow {
  id: string
  name: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  created_at: string
  participant_groups: { group: { name: string } | null }[] | null
}

interface TransactionQueryRow {
  participant_id: string
  points: number | null
  created_at: string
}

interface AwardQueryRow {
  participant_id: string
  reward: { name: string } | null
}

interface TriviaAnswerQueryRow {
  participant_id: string
  answer: { is_correct: boolean } | null
}

interface LotteryWinQueryRow {
  winner_participant_id: string | null
  prize_name: string
}

const GROUPS = 'participant_groups(group:groups(name))'
// There is no email here on purpose: migration 005 dropped the column from
// participants and nothing has asked for one since. A participant is reached
// by phone, not by mail.
const PARTICIPANT_COLUMNS = `id, name, first_name, last_name, phone, created_at, ${GROUPS}`
/** For a database still missing 081 (phone) or 083 (the split name). */
const PARTICIPANT_COLUMNS_BASE = `id, name, created_at, ${GROUPS}`

export interface UseEventParticipantsReportResult {
  rows: ParticipantRow[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useEventParticipantsReport(
  eventId: string | undefined,
): UseEventParticipantsReportResult {
  const [rows, setRows] = useState<ParticipantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId) return
    setError(null)

    const readParticipants = (columns: string) =>
      fetchAllRows<ParticipantQueryRow>((from, to) =>
        supabase
          .from('participants')
          .select(columns)
          .eq('event_id', eventId)
          .order('name')
          .range(from, to),
      )

    const [participantsRes, transactionsRes, awardsRes, lotteryRes] = await Promise.all([
      readParticipants(PARTICIPANT_COLUMNS),
      fetchAllRows<TransactionQueryRow>((from, to) =>
        supabase
          .from('point_transactions')
          .select('participant_id, points, created_at')
          .eq('event_id', eventId)
          .range(from, to),
      ),
      fetchAllRows<AwardQueryRow>((from, to) =>
        supabase
          .from('participant_rewards')
          .select('participant_id, reward:rewards(name)')
          .eq('event_id', eventId)
          .order('awarded_at')
          .range(from, to),
      ),
      fetchAllRows<LotteryWinQueryRow>((from, to) =>
        supabase
          .from('lottery_draws')
          .select('winner_participant_id, prize_name')
          .eq('event_id', eventId)
          .order('drawn_at')
          .range(from, to),
      ),
    ])

    // A schema behind on 081/083 still has every participant - just fewer
    // columns about them. Ask again for the ones that have always existed.
    let participants = participantsRes
    if (participants.error && isMissingColumn(participants.error)) {
      participants = await readParticipants(PARTICIPANT_COLUMNS_BASE)
    }

    // No lottery table means this database predates 080: nobody here has won a
    // lottery, which is a fact about the game and not a failed read.
    const lotteryMissing =
      lotteryRes.error != null && isMissingTable(lotteryRes.error, 'lottery_draws')
    const lotteryWins = lotteryMissing ? [] : lotteryRes.rows

    // Four reads behind one message: without naming the one that broke, a
    // failure here is a guessing game between a schema, a policy and a typo.
    const failed = [
      ['participants', participants.error],
      ['point_transactions', transactionsRes.error],
      ['participant_rewards', awardsRes.error],
      ['lottery_draws', lotteryMissing ? null : lotteryRes.error],
    ].find(([, queryError]) => queryError) as [string, QueryError] | undefined

    if (failed) {
      console.error(`[manage] reading ${failed[0]} failed`, failed[1])
      setError('טעינת נתוני המשתתפים נכשלה. נסו לרענן את הדף.')
      setLoading(false)
      return
    }

    const points = new Map<string, number>()
    const scans = new Map<string, number>()
    const lastScan = new Map<string, string>()
    for (const row of transactionsRes.rows) {
      const id = row.participant_id
      points.set(id, (points.get(id) ?? 0) + (row.points ?? 0))
      scans.set(id, (scans.get(id) ?? 0) + 1)
      const seen = lastScan.get(id)
      if (!seen || row.created_at > seen) lastScan.set(id, row.created_at)
    }

    const rewards = new Map<string, string[]>()
    for (const row of awardsRes.rows) {
      if (!row.reward?.name) continue
      const list = rewards.get(row.participant_id) ?? []
      list.push(row.reward.name)
      rewards.set(row.participant_id, list)
    }

    // The trivia tally, asked on its own: a database without 088 answers with
    // an error, and a game with no questions answers with nothing. Both mean
    // the same thing here - no attempts, and the column drops out of the table.
    //
    // Every scan comes back and the ones with no answer are skipped below,
    // rather than filtered with .not() - the offline player's supabase shim
    // implements a small subset of the query builder, and .not() is not in it.
    const triviaAttempts = new Map<string, number>()
    const triviaCorrect = new Map<string, number>()
    const answersRes = await supabase
      .from('point_transactions')
      .select('participant_id, answer:action_options(is_correct)')
      .eq('event_id', eventId)

    for (const row of (answersRes.data ?? []) as unknown as TriviaAnswerQueryRow[]) {
      if (!row.answer) continue
      const id = row.participant_id
      triviaAttempts.set(id, (triviaAttempts.get(id) ?? 0) + 1)
      if (row.answer.is_correct) triviaCorrect.set(id, (triviaCorrect.get(id) ?? 0) + 1)
    }

    const wins = new Map<string, string[]>()
    for (const row of lotteryWins) {
      // A win whose participant was deleted has nowhere to go - the draw record
      // keeps the name, and that is the lottery tab's job to show, not this one's.
      if (!row.winner_participant_id) continue
      const list = wins.get(row.winner_participant_id) ?? []
      list.push(row.prize_name)
      wins.set(row.winner_participant_id, list)
    }

    setRows(
      withRanks(
        participants.rows.map((row) => ({
          id: row.id,
          name: row.name,
          firstName: row.first_name ?? '',
          lastName: row.last_name ?? '',
          groups: (row.participant_groups ?? [])
            .map((link) => link.group?.name ?? '')
            .filter(Boolean),
          phone: row.phone ?? '',
          points: points.get(row.id) ?? 0,
          scans: scans.get(row.id) ?? 0,
          lastScanAt: lastScan.get(row.id) ?? null,
          rewards: rewards.get(row.id) ?? [],
          lotteryWins: wins.get(row.id) ?? [],
          triviaAttempts: triviaAttempts.get(row.id) ?? 0,
          triviaCorrect: triviaCorrect.get(row.id) ?? 0,
          createdAt: row.created_at,
        })),
      ),
    )
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  return { rows, loading, error, reload: load }
}
