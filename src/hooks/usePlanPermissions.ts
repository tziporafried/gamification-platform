import type { UserPlan } from '@/types'

/** Plans with live QR scanning (trial included - capped server-side at 5 scans). */
const QR_SCAN_PLANS = ['free', 'full', 'organizations', 'offline'] as const

/**
 * Plans with the live-events lottery. Sold as part of the full and offline
 * plans, so the basic plan is locked out; the trial keeps it as a teaser and
 * masks the winner instead (see LotteryPresentation).
 */
const LOTTERY_PLANS = ['free', 'full', 'organizations', 'offline'] as const

export function canRunLottery(plan: UserPlan): boolean {
  return (LOTTERY_PLANS as readonly string[]).includes(plan)
}

export function usePlanPermissions(plan: UserPlan) {
  return {
    canScanQR: (QR_SCAN_PLANS as readonly string[]).includes(plan),
    canRunLottery: canRunLottery(plan),
    /** Locked decorative scanner teaser - no longer used; trial scans for real. */
    showLockedScanner: false,
  }
}
