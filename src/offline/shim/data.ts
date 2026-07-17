import type { GamePack, GameState, LocalScan } from '@/lib/offline/types'
import { loadGameState, saveGameState } from '@/offline/gameState'
import { getGroupLeaderboard, getParticipantLeaderboard } from '@/lib/offline/leaderboard'
import { checkAndAwardRewards, toLocalAwards } from '@/lib/offline/rewardEngine'

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
