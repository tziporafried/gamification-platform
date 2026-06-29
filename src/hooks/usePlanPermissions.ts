import { useAuth } from '@/contexts/AuthContext'

const QR_SCAN_PLANS = ['full', 'organizations'] as const

export function usePlanPermissions() {
  const { profile } = useAuth()
  const plan = profile?.plan ?? 'free'
  return {
    canScanQR: (QR_SCAN_PLANS as readonly string[]).includes(plan),
  }
}
