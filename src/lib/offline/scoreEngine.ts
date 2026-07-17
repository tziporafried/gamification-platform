import { canPerformAction } from '@/lib/canPerformAction'
import { countCompletionsOnIsraelDate } from '@/lib/israelTime'
import type { ScoreSubmitResult } from '@/hooks/useScoreSubmit'
import type { GamePack, GameState, LocalScan } from './types'
import { checkAndAwardRewards, toLocalAwards } from './rewardEngine'
import { getParticipantTotal } from './leaderboard'

/**
 * Local mirror of useScoreSubmit's submit(), with no network.
 *
 * Source of truth: src/hooks/useScoreSubmit.ts
 * Same resolution order, same eligibility rules (via the shared canPerformAction),
 * same shape of result — so the kiosk's existing celebration code is unaffected.
 */

export type OfflineSubmitResponse =
  | { ok: true; result: ScoreSubmitResult; scan: LocalScan; state: GameState }
  | { ok: false; error: string }

function generateClientTxId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for the rare engine without crypto.randomUUID.
  return 'tx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

/** Timestamps of prior completions of this action by this participant. */
function completionTimestamps(
  scans: LocalScan[],
  participantId: string,
  actionId: string,
): string[] {
  const out: string[] = []
  for (const scan of scans) {
    if (scan.participantId === participantId && scan.actionId === actionId) {
      out.push(scan.createdAt)
    }
  }
  return out
}

export function submitOfflineScan(
  pack: GamePack,
  state: GameState,
  participantCode: string,
  actionCode: string,
  now: Date = new Date(),
): OfflineSubmitResponse {
  const pCode = participantCode.trim()
  const aCode = actionCode.trim()

  if (!pCode) return { ok: false, error: 'קוד משתתף הוא שדה חובה.' }
  if (!aCode) return { ok: false, error: 'קוד משימה הוא שדה חובה.' }

  const participant = pack.participants.find((p) => p.external_id === pCode)
  if (!participant) return { ok: false, error: 'קוד לא תקין' }

  const action = pack.actions.find((a) => a.code === aCode)
  if (!action) return { ok: false, error: `משימה "${aCode}" לא נמצאה.` }

  const timestamps = completionTimestamps(state.scans, participant.id, action.id)
  const previousCompletions = timestamps.length
  const previousCompletionsToday = action.daily_limit
    ? countCompletionsOnIsraelDate(timestamps, now)
    : 0

  const allowedGroupIds = pack.actionGroups
    .filter((link) => link.action_id === action.id)
    .map((link) => link.group_id)
  const participantGroupIds = pack.participantGroups
    .filter((membership) => membership.participant_id === participant.id)
    .map((membership) => membership.group_id)

  const check = canPerformAction({
    action: {
      is_active: action.is_active,
      max_completions: action.max_completions,
      daily_limit: action.daily_limit,
      daily_start_hour: action.daily_start_hour,
      daily_start_minute: action.daily_start_minute,
      daily_end_hour: action.daily_end_hour,
      daily_end_minute: action.daily_end_minute,
      allowedGroupIds,
    },
    participantGroupIds,
    previousCompletions,
    previousCompletionsToday,
    now,
  })

  if (!check.allowed) return { ok: false, error: check.message }

  const scan: LocalScan = {
    clientTxId: generateClientTxId(),
    participantId: participant.id,
    actionId: action.id,
    points: action.points,
    createdAt: now.toISOString(),
  }

  const scans = [...state.scans, scan]
  const participantTotalPoints = getParticipantTotal(scans, participant.id)

  const earned = checkAndAwardRewards(pack, scans, state.awards, participant.id)
  const awards = [...state.awards, ...toLocalAwards(earned, participant.id, now)]

  const nextState: GameState = { scans, awards }

  return {
    ok: true,
    scan,
    state: nextState,
    result: {
      transactionId: scan.clientTxId,
      participantId: participant.id,
      participantExternalId: pCode,
      participantGroupIds,
      actionId: action.id,
      actionCode: action.code,
      participantName: participant.name,
      actionName: action.name,
      points: action.points,
      participantTotalPoints,
      celebrationRewards: earned,
      eventScanCount: scans.length,
    },
  }
}