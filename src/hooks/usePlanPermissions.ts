import type { UserPlan } from '@/types'

/** Plans with live QR scanning (trial included — capped server-side at 5 scans). */
const QR_SCAN_PLANS = ['free', 'full', 'organizations'] as const

export function usePlanPermissions(plan: UserPlan) {
  return {
    canScanQR: (QR_SCAN_PLANS as readonly string[]).includes(plan),
    /** Locked decorative scanner teaser — no longer used; trial scans for real. */
    showLockedScanner: false,
  }
}
