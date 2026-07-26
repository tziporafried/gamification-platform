import type { Reward } from '@/types'
import type { GamePack, GameState, LocalAward, LocalScan } from '@/lib/offline/types'
import { loadGameState, saveGameState } from '@/offline/gameState'
import { getGroupLeaderboard, getParticipantLeaderboard, getParticipantTotal } from '@/lib/offline/leaderboard'
import { checkAndAwardRewards, toLocalAwards } from '@/lib/offline/rewardEngine'
import { isParticipantEligibleForReward } from '@/lib/rewardTargeting'

/**
 * Backing store for the offline supabase shim: the embedded pack plus the live
 * game state, with a tiny emitter so the real components' realtime subscriptions
 * fire on local writes (making the kiosk update live, exactly as online).
 */

let pack: GamePack | null = null
let state: GameState = { scans: [], awards: [] }

type ChangeTable = 'point_transactions' | 'participant_rewards' | 'events'
type Listener = (payload: { new: Record<string, unknown> }) => void
const listeners = new Map<ChangeTable, Set<Listener>>()

export function initOfflineData(p: GamePack): void {
  pack = p
  state = loadGameState(p)
}

export function getPack(): GamePack {
  if (!pack) throw new Error('offline data not initialized')
  return pack
}

export function getScans(): LocalScan[] {
  return state.scans
}

/** A synthetic paid event so plan gates open and status reads as active. */
export function getEventRow() {
  const p = getPack()
  return {
    id: p.event.id,
    owner_admin_id: 'offline-owner',
    name: p.event.name,
    slug: 'offline',
    logo_url: p.event.logo_url,
    status: 'active',
    plan: 'full',
    trial_scans_used: 0,
    created_at: p.exportedAt,
    updated_at: p.exportedAt,
  }
}

export const OFFLINE_USER_ID = 'offline-user'

function subscribe(table: ChangeTable, fn: Listener): () => void {
  if (!listeners.has(table)) listeners.set(table, new Set())
  listeners.get(table)!.add(fn)
  return () => listeners.get(table)?.delete(fn)
}

export { subscribe as subscribeToTable }

function emit(table: ChangeTable, row: Record<string, unknown>): void {
  listeners.get(table)?.forEach((fn) => fn({ new: row }))
}

/** Records a scan (eligibility already checked by useScoreSubmit) and notifies. */
export function recordScan(row: {
  event_id: string
  participant_id: string
  action_id: string
  points: number
}): { id: string } {
  const scan: LocalScan = {
    clientTxId:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'tx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
    participantId: row.participant_id,
    actionId: row.action_id,
    points: row.points,
    createdAt: new Date().toISOString(),
  }
  state = { ...state, scans: [...state.scans, scan] }
  saveGameState(getPack(), state)
  emit('point_transactions', { id: scan.clientTxId, event_id: row.event_id })
  return { id: scan.clientTxId }
}

/** The rewards this participant holds that a new total no longer covers. */
function rewardsBelowTotal(participantId: string, total: number, awards: LocalAward[]): Reward[] {
  const p = getPack()
  return awards
    .filter((a) => a.participantId === participantId)
    .map((a) => p.rewards.find((r) => r.id === a.rewardId))
    .filter((r): r is Reward => !!r && r.required_points > total)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'))
}

/**
 * Mirrors next_reward_winner (074): the eligible participant who reached the
 * reward's target EARLIEST and is still above it - replayed from the scan log
 * with the deleted scan already taken out. Null when there is nobody.
 */
function nextRewardWinner(
  reward: Reward,
  scans: LocalScan[],
  awards: LocalAward[],
  excludeParticipantId: string,
): Record<string, unknown> | null {
  const p = getPack()
  const held = new Set(awards.filter((a) => a.rewardId === reward.id).map((a) => a.participantId))
  const rewardGroupIds = p.rewardGroups.filter((l) => l.reward_id === reward.id).map((l) => l.group_id)

  let best: { participantId: string; name: string; total: number; crossedAt: string } | null = null

  for (const participant of p.participants) {
    if (participant.id === excludeParticipantId || held.has(participant.id)) continue

    const eligible = isParticipantEligibleForReward(
      {
        id: participant.id,
        groupIds: p.participantGroups
          .filter((m) => m.participant_id === participant.id)
          .map((m) => m.group_id),
      },
      {
        target_type: reward.target_type,
        target_participant_id: reward.target_participant_id,
        winner_mode: reward.winner_mode,
        groupIds: rewardGroupIds,
      },
    )
    if (!eligible) continue

    const own = scans
      .filter((s) => s.participantId === participant.id)
      .sort((a, b) => (a.createdAt === b.createdAt ? a.clientTxId.localeCompare(b.clientTxId) : a.createdAt < b.createdAt ? -1 : 1))

    let running = 0
    let crossedAt: string | null = null
    for (const scan of own) {
      running += scan.points
      if (running >= reward.required_points) {
        crossedAt = scan.createdAt
        break
      }
    }
    // Crossed it once and is still above it - the prize follows the standing.
    if (!crossedAt || getParticipantTotal(scans, participant.id) < reward.required_points) continue

    const candidate = {
      participantId: participant.id,
      name: participant.name,
      total: getParticipantTotal(scans, participant.id),
      crossedAt,
    }
    if (
      !best ||
      candidate.crossedAt < best.crossedAt ||
      (candidate.crossedAt === best.crossedAt && candidate.name.localeCompare(best.name, 'he') < 0)
    ) {
      best = candidate
    }
  }

  if (!best) return null
  return {
    participant_id: best.participantId,
    name: best.name,
    total_points: best.total,
    crossed_at: best.crossedAt,
  }
}

/** Mirrors the preview_delete_event_scan RPC: what this delete would do. */
export function previewDeleteScan(txId: string): Record<string, unknown> {
  const p = getPack()
  const scan = state.scans.find((s) => s.clientTxId === txId)
  if (!scan) throw new Error('SCAN_NOT_FOUND')

  const remaining = state.scans.filter((s) => s.clientTxId !== txId)
  const newTotal = getParticipantTotal(remaining, scan.participantId)

  return {
    transaction_id: txId,
    event_id: p.event.id,
    participant_id: scan.participantId,
    participant_name: p.participants.find((x) => x.id === scan.participantId)?.name ?? null,
    action_name: p.actions.find((a) => a.id === scan.actionId)?.name ?? null,
    deleted_points: scan.points,
    current_total: getParticipantTotal(state.scans, scan.participantId),
    new_total: newTotal,
    revoked_rewards: rewardsBelowTotal(scan.participantId, newTotal, state.awards).map((reward) => ({
      reward_id: reward.id,
      reward_name: reward.name,
      required_points: reward.required_points,
      winner_mode: reward.winner_mode,
      next_winner:
        reward.winner_mode === 'first'
          ? nextRewardWinner(reward, remaining, state.awards, scan.participantId)
          : null,
    })),
  }
}

/**
 * Mirrors the delete_event_scan RPC: drops one scan, revokes any reward the
 * participant no longer reaches, and passes on the ones the operator chose to
 * transfer - exactly as the SQL function does online.
 */
export function deleteScan(
  txId: string,
  transfers: { reward_id: string; participant_id: string }[] = [],
): Record<string, unknown> {
  const p = getPack()
  const scan = state.scans.find((s) => s.clientTxId === txId)
  if (!scan) throw new Error('SCAN_NOT_FOUND')

  const scans = state.scans.filter((s) => s.clientTxId !== txId)
  const total = getParticipantTotal(scans, scan.participantId)
  const revokedRewards = rewardsBelowTotal(scan.participantId, total, state.awards)
  const revokedIds = new Set(revokedRewards.map((r) => r.id))

  let awards = state.awards.filter(
    (a) => a.participantId !== scan.participantId || !revokedIds.has(a.rewardId),
  )

  const now = new Date().toISOString()
  const outcomes = revokedRewards.map((reward) => {
    const transfer = transfers.find((t) => t.reward_id === reward.id)
    if (!transfer) return { reward, transferredTo: null as Record<string, unknown> | null }

    if (reward.winner_mode !== 'first') throw new Error(`TRANSFER_NOT_FIRST_WINNER: ${reward.name}`)

    // Same guard as online: the transfer has to still be the rightful one.
    const next = nextRewardWinner(reward, scans, awards, scan.participantId)
    if (!next || next.participant_id !== transfer.participant_id) {
      throw new Error(`TRANSFER_NOT_ELIGIBLE: ${reward.name}`)
    }

    awards = [
      ...awards,
      {
        participantId: transfer.participant_id,
        rewardId: reward.id,
        scoreAtAward: next.total_points as number,
        awardedAt: now,
      },
    ]
    return { reward, transferredTo: { participant_id: next.participant_id, name: next.name } }
  })

  state = { scans, awards }
  saveGameState(p, state)
  emit('point_transactions', { id: txId, event_id: p.event.id })

  return {
    event_id: p.event.id,
    participant_id: scan.participantId,
    deleted_points: scan.points,
    participant_total_points: total,
    revoked_rewards: outcomes.map(({ reward, transferredTo }) => ({
      reward_id: reward.id,
      reward_name: reward.name,
      winner_mode: reward.winner_mode,
      transferred_to: transferredTo,
    })),
  }
}

/** Mirrors the check_and_award_rewards RPC: award, persist, notify, return rows. */
export function awardRewards(participantId: string) {
  const p = getPack()
  const earned = checkAndAwardRewards(p, state.scans, state.awards, participantId)
  if (earned.length > 0) {
    const now = new Date()
    state = { ...state, awards: [...state.awards, ...toLocalAwards(earned, participantId, now)] }
    saveGameState(p, state)
    for (const r of earned) {
      emit('participant_rewards', {
        id: `${participantId}:${r.out_reward_id}`,
        event_id: p.event.id,
        participant_id: participantId,
        reward_id: r.out_reward_id,
      })
    }
  }
  return earned
}

export function participantLeaderboard() {
  return getParticipantLeaderboard(getPack(), state.scans)
}

export function groupLeaderboard() {
  return getGroupLeaderboard(getPack(), state.scans)
}

/** point_transactions as flat rows, newest first, for read queries. */
export function scanRows() {
  const p = getPack()
  const pById = new Map(p.participants.map((x) => [x.id, x]))
  const aById = new Map(p.actions.map((x) => [x.id, x]))
  return state.scans
    .map((s) => ({
      id: s.clientTxId,
      event_id: p.event.id,
      participant_id: s.participantId,
      action_id: s.actionId,
      points: s.points,
      created_at: s.createdAt,
      participant: pById.get(s.participantId)
        ? { name: pById.get(s.participantId)!.name, external_id: pById.get(s.participantId)!.external_id }
        : null,
      action: aById.get(s.actionId)
        ? { id: aById.get(s.actionId)!.id, name: aById.get(s.actionId)!.name, code: aById.get(s.actionId)!.code }
        : null,
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

/** participant_rewards as rows with joins, newest first. */
export function awardRows() {
  const p = getPack()
  const pById = new Map(p.participants.map((x) => [x.id, x]))
  const rById = new Map(p.rewards.map((x) => [x.id, x]))
  return state.awards
    .map((a) => ({
      id: `${a.participantId}:${a.rewardId}`,
      event_id: p.event.id,
      participant_id: a.participantId,
      reward_id: a.rewardId,
      score_at_award: a.scoreAtAward,
      awarded_at: a.awardedAt,
      reward: rById.get(a.rewardId)
        ? { name: rById.get(a.rewardId)!.name, required_points: rById.get(a.rewardId)!.required_points }
        : null,
      participant: pById.get(a.participantId) ? { name: pById.get(a.participantId)!.name } : null,
    }))
    .sort((a, b) => (a.awarded_at < b.awarded_at ? 1 : -1))
}
