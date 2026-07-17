import type { GroupLeaderboardEntry, ParticipantLeaderboardEntry } from '@/types'
import type { GamePack, LocalScan } from './types'

/**
 * Local mirror of get_participant_leaderboard / get_group_leaderboard.
 *
 * Source of truth: supabase/migrations/020_fix_leaderboard_multi_event.sql
 * Keep the two in step — the ranking a player sees offline should match what
 * the same event shows online.
 */

function pointsByParticipant(scans: LocalScan[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const scan of scans) {
    totals.set(scan.participantId, (totals.get(scan.participantId) ?? 0) + scan.points)
  }
  return totals
}

/** Hebrew-aware stand-in for the database's ORDER BY name ASC. */
function byName(a: string, b: string): number {
  return a.localeCompare(b, 'he')
}

/**
 * Every participant appears, scored or not — the SQL LEFT JOINs transactions
 * and COALESCEs the sum to 0.
 */
export function getParticipantLeaderboard(
  pack: GamePack,
  scans: LocalScan[],
): ParticipantLeaderboardEntry[] {
  const totals = pointsByParticipant(scans)

  return pack.participants
    .map((participant) => ({
      participant_id: participant.id,
      participant_name: participant.name,
      external_id: participant.external_id,
      total_points: totals.get(participant.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.total_points - a.total_points || byName(a.participant_name, b.participant_name),
    )
}

/**
 * A group's score is the sum of its members' scans. A participant in two groups
 * counts toward both — that is what the SQL's join produces, not a bug.
 */
export function getGroupLeaderboard(pack: GamePack, scans: LocalScan[]): GroupLeaderboardEntry[] {
  const perParticipant = pointsByParticipant(scans)
  const totals = new Map<string, number>(pack.groups.map((group) => [group.id, 0]))

  for (const membership of pack.participantGroups) {
    const current = totals.get(membership.group_id)
    if (current === undefined) continue
    totals.set(membership.group_id, current + (perParticipant.get(membership.participant_id) ?? 0))
  }

  return pack.groups
    .map((group) => ({
      group_id: group.id,
      group_name: group.name,
      group_color: group.color,
      total_points: totals.get(group.id) ?? 0,
    }))
    .sort((a, b) => b.total_points - a.total_points || byName(a.group_name, b.group_name))
}

/** Total for one participant — the figure rewards are judged against. */
export function getParticipantTotal(scans: LocalScan[], participantId: string): number {
  let total = 0
  for (const scan of scans) {
    if (scan.participantId === participantId) total += scan.points
  }
  return total
}
