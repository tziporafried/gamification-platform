import { canPerformAction } from '@/lib/canPerformAction'
import { countCompletionsOnIsraelDate } from '@/lib/israelTime'
import { isCorrectScan, isTriviaAction, scanPoints, TRIVIA_ANSWER_REQUIRED_MESSAGE, type ScannedOption } from '@/lib/tasks/triviaScan'
import type { ScoreSubmitResult } from '@/hooks/useScoreSubmit'
import type { GamePack, GameState, LocalScan } from './types'
import { checkAndAwardRewards, toLocalAwards } from './rewardEngine'
import { getParticipantTotal } from './leaderboard'

/**
 * Local mirror of useScoreSubmit's submit(), with no network.
 *
 * Source of truth: src/hooks/useScoreSubmit.ts
 * Same resolution order, same eligibility rules (via the shared canPerformAction),
 * same shape of result - so the kiosk's existing celebration code is unaffected.
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

  // Same two steps as useScoreSubmit: a task's code first, then a trivia answer
  // card's. A pack exported before 088 has no `actionOptions` at all, and the
  // fallback below simply finds nothing.
  let action = pack.actions.find((a) => a.code === aCode)
  let option: ScannedOption | null = null

  if (!action) {
    const match = (pack.actionOptions ?? []).find((o) => o.code === aCode)
    const parent = match && pack.actions.find((a) => a.id === match.action_id)
    if (match && parent) {
      action = parent
      option = { id: match.id, label: match.label, is_correct: match.is_correct }
    }
  }

  if (!action) return { ok: false, error: `משימה "${aCode}" לא נמצאה.` }

  // The question's own code rather than one of its answers - manual entry only,
  // and worth the full points if it were let through.
  if (!option && isTriviaAction(action)) {
    return { ok: false, error: TRIVIA_ANSWER_REQUIRED_MESSAGE }
  }

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

  const isCorrect = isCorrectScan(option)

  const scan: LocalScan = {
    clientTxId: generateClientTxId(),
    participantId: participant.id,
    actionId: action.id,
    actionOptionId: option?.id ?? null,
    points: scanPoints(action.points, option),
    createdAt: now.toISOString(),
  }

  const scans = [...state.scans, scan]
  const participantTotalPoints = getParticipantTotal(scans, participant.id)

  const earned = checkAndAwardRewards(pack, scans, state.awards, participant.id)
  const awards = [...state.awards, ...toLocalAwards(earned, participant.id, now)]

  const nextState: GameState = { ...state, scans, awards }

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
      points: scan.points,
      participantTotalPoints,
      celebrationRewards: earned,
      eventScanCount: scans.length,
      isCorrect,
      optionId: option?.id ?? null,
      optionLabel: option?.label ?? null,
    },
  }
}