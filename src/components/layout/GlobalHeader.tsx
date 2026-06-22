import { useNavigate } from 'react-router-dom'
import { LogOut, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function GlobalHeader() {
  const { user, profile, signOut, isSuperAdmin } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const displayName = profile?.display_name || user.email?.split('@')[0] || ''

  return (
    <header className="sticky top-0 z-40 border-b border-game-border bg-game-dark/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-2.5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand text-sm font-bold text-white">
            G
          </div>
          <span className="text-sm font-bold text-white hidden sm:inline">פלטפורמת משחוק</span>
        </button>

        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Shield size={16} />
              <span className="hidden sm:inline">ניהול</span>
            </button>
          )}
          <span className="text-sm text-gray-400 hidden sm:inline">{displayName}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
