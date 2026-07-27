import type { ParticipantLeaderboardEntry } from '@/types'
import type { EligibleParticipant, LotteryEligibilityMode } from '../types'

/**
 * Who ends up in the hat, for the three points-based ways of choosing.
 *
 * 'scans' is not here: that pool is whoever was scanned in on the lottery
 * screen (see scanLotteryStore), not a filter over the leaderboard at all.
 * Everything else is a filter over the same leaderboard rows the lottery has
 * always used, which is why they share one function.
 *
 * Pure, and given its inputs explicitly, so the rules can be exercised without
 * a database - the hook around it owns only the loading.
 */

/** Group membership, as `participant id → group ids`. */
export type GroupMembership = ReadonlyMap<string, readonly string[]>

export interface EligibilityCriteria {
  mode: LotteryEligibilityMode
  /** Only read when mode is 'min_points'. */
  minPoints: number
  /** Only read when mode is 'groups'. */
  groupIds: ReadonlySet<string>
}

export function emptyCriteria(mode: LotteryEligibilityMode = 'all'): EligibilityCriteria {
  return { mode, minPoints: 0, groupIds: new Set() }
}

/**
 * True when the choice still needs something picked before it means anything.
 *
 * "By groups" with none ticked is not an empty lottery, it is an unfinished
 * sentence - and it must not read as "nobody is eligible", which is a
 * different problem with a different fix.
 */
export function isCriteriaIncomplete(criteria: EligibilityCriteria): boolean {
  return criteria.mode === 'groups' && criteria.groupIds.size === 0
}

function matches(
  row: ParticipantLeaderboardEntry,
  criteria: EligibilityCriteria,
  membership: GroupMembership,
): boolean {
  switch (criteria.mode) {
    case 'all':
      return true
    case 'min_points':
      // Unchanged from before the other choices existed: at or above the line.
      return row.total_points >= Math.max(0, Math.floor(criteria.minPoints))
    case 'groups': {
      const groups = membership.get(row.participant_id)
      if (!groups) return false
      return groups.some((id) => criteria.groupIds.has(id))
    }
    case 'scans':
      // Never reached - a scan pool does not come from the leaderboard. Listed
      // so adding a mode without deciding this is a type error, not a silent
      // "everyone is eligible".
      return false
  }
}

export function filterEligible(
  rows: readonly ParticipantLeaderboardEntry[],
  criteria: EligibilityCriteria,
  membership: GroupMembership,
  excludeIds?: ReadonlySet<string>,
): EligibleParticipant[] {
  if (isCriteriaIncomplete(criteria)) return []
  return rows
    .filter((row) => {
      if (excludeIds?.has(row.participant_id)) return false
      return matches(row, criteria, membership)
    })
    .map((row) => ({
      id: row.participant_id,
      name: row.participant_name,
      points: Number(row.total_points),
      // One name in the hat per eligible player - none of these four weight
      // the draw. Only the scan pool hands out more than one ticket.
      entries: 1,
    }))
}
