import { useNavigate } from 'react-router-dom'
import { LogOut, UserRound } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function ImpersonationBanner() {
  const { isImpersonating, impersonationTarget, stopImpersonating } = useAuth()
  const navigate = useNavigate()

  if (!isImpersonating || !impersonationTarget) return null

  const label =
    impersonationTarget.displayName ||
    impersonationTarget.email.split('@')[0] ||
    impersonationTarget.email

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex items-center justify-between gap-3 border-b border-warning/40 bg-warning px-4 py-2 text-sm text-warning-text sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-2">
        <UserRound size={16} className="shrink-0" aria-hidden="true" />
        <p className="truncate">
          מחוברת כלקוח: <span className="font-semibold">{label}</span>
          <span className="hidden sm:inline"> — את רואה בדיוק מה שהלקוח רואה</span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          void stopImpersonating().then(() => navigate('/admin/customers'))
        }}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-black/10 px-3 py-1.5 text-xs font-semibold hover:bg-black/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
      >
        <LogOut size={14} aria-hidden="true" />
        חזרה לניהול
      </button>
    </div>
  )
}
