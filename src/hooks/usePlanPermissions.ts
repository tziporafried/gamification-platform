import type { UserPlan } from '@/types'

const QR_SCAN_PLANS = ['full', 'organizations'] as const

export function usePlanPermissions(plan: UserPlan) {
  return {
    canScanQR: (QR_SCAN_PLANS as readonly string[]).includes(plan),
    showLockedScanner: plan === 'free',
  }
}
