import { useMemo } from 'react'
import type { EligibleParticipant, LotteryEligibilityMode } from './types'
import { modeForEligibility, totalEntries } from './lottery/lotteryMode'
import { isCriteriaIncomplete, type EligibilityCriteria } from './lottery/lotteryEligibility'
import { useEligibleParticipants } from './useEligibleParticipants'
import { useLotteryRoster, type LotteryGroup } from './useLotteryRoster'
import { useScanLotteryRound, type ScanLotteryRoundState } from './useScanLotteryRound'

/**
 * The lottery entry service: one pool, whichever choice built it.
 *
 * All four choices end at the same place - a list of participants, one ticket
 * each - so everything downstream (the launch button, the intro, the draw)
 * reads one shape and never branches. What differs is only how the list is
 * produced: three filter the leaderboard, and 'scans' reads whoever was
 * scanned in on the lottery screen.
 *
 * Every hook here is called on every render (hooks cannot be conditional) but
 * the ones the current choice does not need are switched off through their
 * `enabled` flag, so an unused branch issues no queries.
 */

/** Why the show cannot start yet. Doubles as the analytics `reason`. */
export type LotteryLaunchBlocker = 'no_eligible' | 'nothing_picked' | 'not_opened' | 'still_open'

export interface LotteryEntryPool {
  participants: EligibleParticipant[]
  /** People in the pool. */
  count: number
  /** Tickets in the hat. One each, so this equals `count`. */
  entries: number
  loading: boolean
  error: string | null
  /** null once the pool can be drawn from. */
  blockedBy: LotteryLaunchBlocker | null
  /** The collection's controls, when choosing by scans. */
  scan: ScanLotteryRoundState | null
  /** The game's groups - the "לפי קבוצות" picker's options. */
  groups: LotteryGroup[]
  /** True while the group picker's own options are still loading. */
  optionsLoading: boolean
}

interface UseLotteryEntriesOptions {
  eventId: string
  criteria: EligibilityCriteria
}

export function useLotteryEntries({ eventId, criteria }: UseLotteryEntriesOptions): LotteryEntryPool {
  const mode = modeForEligibility(criteria.mode)
  const isScan = mode === 'scan'
  const needsGroups = criteria.mode === 'groups'

  const roster = useLotteryRoster(eventId, needsGroups)
  const points = useEligibleParticipants({
    eventId,
    criteria,
    membership: roster.membership,
    enabled: !isScan,
  })
  const scan = useScanLotteryRound(eventId)

  return useMemo<LotteryEntryPool>(() => {
    if (!isScan) {
      // Loading is not "no answer yet" only for the pool - a group filter run
      // before its membership has arrived would find nobody, which reads as an
      // empty lottery rather than as a moment of waiting.
      const loading = points.loading || (needsGroups && roster.loading)
      const blockedBy: LotteryLaunchBlocker | null = loading
        ? null
        : isCriteriaIncomplete(criteria)
          ? 'nothing_picked'
          : points.count > 0
            ? null
            : 'no_eligible'

      return {
        participants: points.participants,
        count: points.count,
        entries: totalEntries(points.participants),
        loading,
        error: points.error ?? roster.error,
        blockedBy,
        scan: null,
        groups: roster.groups,
        optionsLoading: roster.loading,
      }
    }

    // A scan lottery is drawn only after the collection has closed - that is
    // what closing means. Before then the pool is still moving.
    const blockedBy: LotteryLaunchBlocker | null =
      scan.status === 'idle'
        ? 'not_opened'
        : scan.status === 'open'
          ? 'still_open'
          : scan.count > 0
            ? null
            : 'no_eligible'

    return {
      participants: scan.participants,
      count: scan.count,
      entries: scan.entries,
      // Nothing to wait for and nothing to fail: it is read from localStorage.
      loading: false,
      error: null,
      blockedBy,
      scan,
      groups: [],
      optionsLoading: false,
    }
  }, [isScan, needsGroups, criteria, points, roster, scan])
}

/** Re-exported so the dock can name a group without a second import path. */
export type { LotteryGroup } from './useLotteryRoster'
export type { LotteryEligibilityMode }
