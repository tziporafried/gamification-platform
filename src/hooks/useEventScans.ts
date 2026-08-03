import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * The event's scan log for the management screen, grouped per participant.
 *
 * Reads and deletes go through supabase, which the offline player aliases to
 * its own shim - so the same screen runs unchanged from an exported file.
 */

export interface EventScan {
  id: string
  participantId: string
  actionName: string
  points: number
  createdAt: string
  /**
   * The answer scanned, for a trivia task. Null for every standard scan.
   *
   * Without it the log shows a scan worth 0 points against a task worth 20 and
   * offers no explanation - which reads as a bug in the scoring rather than a
   * participant who picked the wrong card.
   */
  answerLabel?: string | null
  /** False only for a wrong trivia answer. */
  isCorrect?: boolean
  /**
   * Awarded by the operator rather than scanned (092). `actionName` then holds
   * the reason they typed, so the row still explains itself - but the log has
   * to say which of the two it is, or a bonus reads as a task nobody can find
   * in the game's task list.
   */
  isBonus?: boolean
}

export interface ParticipantScans {
  participantId: string
  name: string
  scans: EventScan[]
  totalPoints: number
}

export type RewardWinnerMode = 'all' | 'first'

/** The participant a 'first' reward should pass to - see 074's next_reward_winner. */
export interface NextRewardWinner {
  participantId: string
  name: string
  totalPoints: number
  crossedAt: string
}

export interface RevokedRewardPreview {
  rewardId: string
  rewardName: string
  requiredPoints: number
  winnerMode: RewardWinnerMode
  nextWinner: NextRewardWinner | null
}

/** What deleting one scan would do, before anything is written. */
export interface ScanDeletionPreview {
  participantName: string
  actionName: string
  deletedPoints: number
  currentTotal: number
  newTotal: number
  revoked: RevokedRewardPreview[]
}

export interface RevokedRewardOutcome {
  rewardId: string
  rewardName: string
  winnerMode: RewardWinnerMode
  transferredTo: { participantId: string; name: string } | null
}

/** What the delete actually did, so the operator can be told how it ended. */
export interface ScanDeletionResult {
  newTotal: number
  revoked: RevokedRewardOutcome[]
}

/** A reward the operator chose to pass on rather than leave unclaimed. */
export interface RewardTransfer {
  rewardId: string
  participantId: string
}

interface ScanQueryRow {
  id: string
  points: number | null
  created_at: string
  participant_id: string
  /** Undefined on a database that has not run 092 - see the note on the query. */
  bonus_reason?: string | null
  participant: { name: string } | null
  action: { name: string } | null
}

interface ParticipantQueryRow {
  id: string
  name: string
}

interface AnswerQueryRow {
  id: string
  answer: { label: string; is_correct: boolean } | null
}

/** The JSONB the two RPCs in migration 074 return, as it arrives. */
interface PreviewRow {
  participant_name: string | null
  action_name: string | null
  deleted_points: number | null
  current_total: number | string | null
  new_total: number | string | null
  revoked_rewards: {
    reward_id: string
    reward_name: string
    required_points: number
    winner_mode: RewardWinnerMode
    next_winner: {
      participant_id: string
      name: string
      total_points: number | string | null
      crossed_at: string
    } | null
  }[] | null
}

interface DeleteRow {
  participant_total_points: number | string | null
  revoked_rewards: {
    reward_id: string
    reward_name: string
    winner_mode: RewardWinnerMode
    transferred_to: { participant_id: string; name: string } | null
  }[] | null
}

/** Everyone who scanned first (most points first), then the rest by name. */
function sortParticipants(rows: ParticipantScans[]): ParticipantScans[] {
  return [...rows].sort((a, b) => {
    if (a.scans.length !== b.scans.length && (a.scans.length === 0 || b.scans.length === 0)) {
      return a.scans.length === 0 ? 1 : -1
    }
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    return a.name.localeCompare(b.name, 'he')
  })
}

/** The answer each trivia scan carried, by transaction id. Empty without 088. */
type AnswersByScan = Map<string, { label: string; isCorrect: boolean }>

function buildRows(
  scans: ScanQueryRow[],
  participants: ParticipantQueryRow[],
  answers: AnswersByScan = new Map(),
): ParticipantScans[] {
  const byParticipant = new Map<string, ParticipantScans>()

  for (const p of participants) {
    byParticipant.set(p.id, {
      participantId: p.id,
      name: p.name,
      scans: [],
      totalPoints: 0,
    })
  }

  for (const scan of scans) {
    // A scan whose participant was deleted still belongs in the log; fall back
    // to the name embedded in the join rather than dropping the row.
    let entry = byParticipant.get(scan.participant_id)
    if (!entry) {
      entry = {
        participantId: scan.participant_id,
        name: scan.participant?.name ?? 'משתתף שנמחק',
        scans: [],
        totalPoints: 0,
      }
      byParticipant.set(scan.participant_id, entry)
    }
    const answer = answers.get(scan.id)
    // A bonus has no task by design, so "משימה שנמחקה" would be a lie about a
    // row that is intact and says why it exists.
    const bonusReason = scan.bonus_reason ?? null
    entry.scans.push({
      id: scan.id,
      participantId: scan.participant_id,
      actionName: bonusReason ?? scan.action?.name ?? 'משימה שנמחקה',
      points: scan.points ?? 0,
      createdAt: scan.created_at,
      answerLabel: answer?.label ?? null,
      isCorrect: answer ? answer.isCorrect : true,
      isBonus: !!bonusReason,
    })
    entry.totalPoints += scan.points ?? 0
  }

  return sortParticipants([...byParticipant.values()])
}

export function useEventScans(eventId: string | undefined) {
  const [participants, setParticipants] = useState<ParticipantScans[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId) return
    setError(null)

    const [scansRes, participantsRes] = await Promise.all([
      supabase
        .from('point_transactions')
        // `*` rather than a column list, so `bonus_reason` (092) comes back
        // where the database has it and its absence does not take the whole
        // scan log down - the same reason useScoreSubmit reads an action that
        // way. The row is seven small columns.
        .select('*, participant:participants(name), action:actions(name)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      supabase
        .from('participants')
        .select('id, name')
        .eq('event_id', eventId),
    ])

    if (scansRes.error || participantsRes.error) {
      setError('טעינת הסריקות נכשלה. נסו לרענן את הדף.')
      setLoading(false)
      return
    }

    // Asked separately rather than joined into the query above: a database
    // that has not run 088 has no such column, and the join would take the
    // whole scan log down with it. On its own, a failure here just means no
    // scan carried an answer - which is exactly true of such a database.
    const answers: AnswersByScan = new Map()
    const answersRes = await supabase
      .from('point_transactions')
      .select('id, answer:action_options(label, is_correct)')
      .eq('event_id', eventId)

    // Rows with no `answer` are ordinary scans - most of them, usually.
    for (const row of (answersRes.data ?? []) as unknown as AnswerQueryRow[]) {
      if (row.answer) answers.set(row.id, { label: row.answer.label, isCorrect: row.answer.is_correct })
    }

    setParticipants(
      buildRows(
        (scansRes.data ?? []) as unknown as ScanQueryRow[],
        (participantsRes.data ?? []) as unknown as ParticipantQueryRow[],
        answers,
      ),
    )
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  /**
   * What deleting this scan would cost, asked before anything is written: the
   * new total, and every reward that would be revoked with the participant the
   * reward should pass to when only its first winner may hold it.
   */
  const previewDelete = useCallback(
    async (scanId: string): Promise<{ ok: true; preview: ScanDeletionPreview } | { ok: false; error: string }> => {
      const { data, error: rpcError } = await supabase.rpc('preview_delete_event_scan', {
        p_transaction_id: scanId,
      })

      if (rpcError || !data) {
        return { ok: false, error: 'בדיקת ההשפעה של המחיקה נכשלה. נסו שוב.' }
      }

      const row = data as PreviewRow
      return {
        ok: true,
        preview: {
          participantName: row.participant_name ?? 'משתתף שנמחק',
          actionName: row.action_name ?? 'משימה שנמחקה',
          deletedPoints: row.deleted_points ?? 0,
          currentTotal: Number(row.current_total ?? 0),
          newTotal: Number(row.new_total ?? 0),
          revoked: (row.revoked_rewards ?? []).map((reward) => ({
            rewardId: reward.reward_id,
            rewardName: reward.reward_name,
            requiredPoints: reward.required_points,
            winnerMode: reward.winner_mode,
            nextWinner: reward.next_winner
              ? {
                  participantId: reward.next_winner.participant_id,
                  name: reward.next_winner.name,
                  totalPoints: Number(reward.next_winner.total_points ?? 0),
                  crossedAt: reward.next_winner.crossed_at,
                }
              : null,
          })),
        },
      }
    },
    [],
  )

  /**
   * Removes one scan, carrying out the transfers the operator approved. The row
   * is dropped from local state on success rather than refetching - the totals
   * are derived, so they follow on their own.
   */
  const deleteScan = useCallback(async (
    scanId: string,
    transfers: RewardTransfer[] = [],
  ): Promise<{ ok: true; result: ScanDeletionResult } | { ok: false; error: string }> => {
    const { data, error: rpcError } = await supabase.rpc('delete_event_scan', {
      p_transaction_id: scanId,
      p_transfers: transfers.map((t) => ({ reward_id: t.rewardId, participant_id: t.participantId })),
    })

    if (rpcError) {
      // The one failure the operator can act on: someone scanned while the
      // dialog was open and the prize is owed to someone else now.
      const message = String((rpcError as { message?: string }).message ?? '')
      return {
        ok: false,
        error: message.includes('TRANSFER_NOT_ELIGIBLE')
          ? 'המצב השתנה בזמן שהחלון היה פתוח - הפרס כבר לא מגיע למי שנבחר. סגרו ופתחו שוב את המחיקה.'
          : 'מחיקת הסריקה נכשלה. נסו שוב.',
      }
    }

    setParticipants((prev) =>
      sortParticipants(
        prev.map((entry) => {
          const scan = entry.scans.find((s) => s.id === scanId)
          if (!scan) return entry
          return {
            ...entry,
            scans: entry.scans.filter((s) => s.id !== scanId),
            totalPoints: entry.totalPoints - scan.points,
          }
        }),
      ),
    )

    const row = (data ?? {}) as DeleteRow
    return {
      ok: true,
      result: {
        newTotal: Number(row.participant_total_points ?? 0),
        revoked: (row.revoked_rewards ?? []).map((reward) => ({
          rewardId: reward.reward_id,
          rewardName: reward.reward_name,
          winnerMode: reward.winner_mode,
          transferredTo: reward.transferred_to
            ? {
                participantId: reward.transferred_to.participant_id,
                name: reward.transferred_to.name,
              }
            : null,
        })),
      },
    }
  }, [])

  return { participants, loading, error, reload: load, previewDelete, deleteScan }
}
