import { supabase } from '@/lib/supabase'
import type { EligibleParticipant } from '../types'

/**
 * The scan lottery's collection window (`lottery_rounds`, 080) and its tickets
 * (`lottery_entries`, 081).
 *
 * A round is a span of time the organizer opens and closes. While it is open,
 * scanning **on the lottery screen** earns a ticket - one per participant,
 * however many times they scan.
 *
 * The lottery is deliberately not connected to the game's other scanning
 * stations. Scans taken there score points as they always have and are no part
 * of this pool: a ticket is earned at the lottery, in front of the room, which
 * is why it is a row written by this screen's scanner rather than something
 * counted out of the game's scan log afterwards.
 */

export type ScanLotteryRoundStatus = 'idle' | 'open' | 'closed'

export interface ScanLotteryRound {
  id: string
  eventId: string
  openedAt: string
  /** null while the round is still collecting. */
  closedAt: string | null
}

const ROUND_COLUMNS = 'id, event_id, opened_at, closed_at'

interface RoundRow {
  id: string
  event_id: string
  opened_at: string
  closed_at: string | null
}

function toRound(row: RoundRow): ScanLotteryRound {
  return {
    id: row.id,
    eventId: row.event_id,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  }
}

export function roundStatus(round: ScanLotteryRound | null): ScanLotteryRoundStatus {
  if (!round) return 'idle'
  return round.closedAt ? 'closed' : 'open'
}

/**
 * True when the read failed because 080 has not run yet.
 *
 * Same contract as isMissingFeatureTableError in lib/eventFeatures: a missing
 * table is not an error to shout about, it is "there are no rounds". The dock
 * turns that into a message telling the operator the migration is pending,
 * rather than a raw postgres string.
 */
export function isMissingScanLotteryTableError(message: string | null | undefined): boolean {
  if (!message) return false
  const missing = message.includes('does not exist') || message.includes('schema cache')
  return missing && (message.includes('lottery_rounds') || message.includes('get_scan_lottery_entries'))
}

/**
 * The game's round that is still collecting, if there is one.
 *
 * Deliberately only the open one. A round still collecting has to be resumed:
 * an organizer who refreshes the tab, or opens the lottery on a second screen,
 * must land back in the same window rather than start a second one and split
 * the floor's scans between two pools.
 *
 * A *closed* round is history, and resuming it was a bug: it meant that once a
 * game had ever run one scan lottery, the dock never showed "פתחו את ההגרלה"
 * again - it came up already holding yesterday's finished pool, which reads
 * exactly like a button that pressed itself. Setting up a new lottery starts
 * from nothing; a round closed during this session stays on screen because the
 * screen is still holding it, not because it was fetched back.
 */
export async function fetchOpenScanLotteryRound(eventId: string): Promise<ScanLotteryRound | null> {
  const { data, error } = await supabase
    .from('lottery_rounds')
    .select(ROUND_COLUMNS)
    .eq('event_id', eventId)
    .is('closed_at', null)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ? toRound(data as RoundRow) : null
}

/**
 * Opens a round, or returns the one already open.
 *
 * A partial unique index in 080 allows only one open round per game, so two
 * organizer screens racing to open one cannot split the floor's scans between
 * two pools - the loser of the race reads back the winner's round and both
 * screens collect into it.
 */
export async function openScanLotteryRound(
  eventId: string,
  openedBy: string | undefined,
): Promise<ScanLotteryRound> {
  const { data, error } = await supabase
    .from('lottery_rounds')
    .insert({ event_id: eventId, opened_by: openedBy ?? null })
    .select(ROUND_COLUMNS)
    .single()

  if (error) {
    // 23505 = the one-open-round index. Someone else opened it first.
    if (error.code === '23505') {
      const existing = await fetchOpenScanLotteryRound(eventId)
      if (existing) return existing
    }
    throw error
  }
  return toRound(data as RoundRow)
}

/**
 * Closes the round. Scans after this moment are not entries.
 *
 * Guarded on closed_at IS NULL so closing twice - two screens, or a double
 * click - cannot move the cutoff and silently drop tickets that were already
 * counted. A second close reads back the round unchanged.
 */
export async function closeScanLotteryRound(roundId: string): Promise<ScanLotteryRound> {
  const { data, error } = await supabase
    .from('lottery_rounds')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', roundId)
    .is('closed_at', null)
    .select(ROUND_COLUMNS)
    .maybeSingle()

  if (error) throw error
  if (data) return toRound(data as RoundRow)

  const { data: already, error: readError } = await supabase
    .from('lottery_rounds')
    .select(ROUND_COLUMNS)
    .eq('id', roundId)
    .single()
  if (readError) throw readError
  return toRound(already as RoundRow)
}

/**
 * Writes the ticket a scan just earned.
 *
 * Called only by the lottery's own scanner - that is the whole point of the
 * table (081). A scan taken at any other station in the game never reaches
 * here and so never joins the pool.
 *
 * Returns whether this was the participant's first ticket in the round. The
 * primary key (round_id, participant_id) caps them at one, so a second scan
 * conflicts instead of adding; that is not an error to report but the answer
 * to "do they already have one", which the stage says out loud.
 */
export async function recordScanLotteryEntry(params: {
  roundId: string
  participantId: string
  transactionId: string
}): Promise<{ isNewTicket: boolean }> {
  const { data, error } = await supabase
    .from('lottery_entries')
    .upsert(
      {
        round_id: params.roundId,
        participant_id: params.participantId,
        transaction_id: params.transactionId,
      },
      { onConflict: 'round_id,participant_id', ignoreDuplicates: true },
    )
    .select('participant_id')

  if (error) throw error
  // ignoreDuplicates returns the inserted rows only - empty means they were
  // already holding a ticket.
  return { isNewTicket: (data ?? []).length > 0 }
}

interface EntryRow {
  participant_id: string
  participant_name: string
  entries: number | string
}

/**
 * The pool: everyone holding a ticket in this round. Shaped as
 * EligibleParticipant so the draw, the intro and the raffle ceremony take it
 * without knowing which choice produced it.
 *
 * `points` is 0 by design - the whole point of this choice is that points are
 * ignored - and `entries` is 1 each, capped by the table's primary key.
 */
export async function fetchScanLotteryEntries(roundId: string): Promise<EligibleParticipant[]> {
  const { data, error } = await supabase.rpc('get_scan_lottery_entries', { p_round_id: roundId })
  if (error) throw error

  return ((data ?? []) as EntryRow[])
    .map((row) => ({
      id: row.participant_id,
      name: row.participant_name,
      points: 0,
      entries: Number(row.entries),
    }))
    .filter((p) => p.entries > 0)
}
