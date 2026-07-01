import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useHeaderSlot } from '@/contexts/HeaderSlotContext'

export function GlobalHeader() {
  const { user, profile, signOut, isSuperAdmin } = useAuth()
  const { centerSlot } = useHeaderSlot()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = profile?.display_name || user?.email?.split('@')[0] || ''
  const avatarUrl = profile?.avatar_url

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) return null

  return (
    <header className="sticky top-0 z-40 bg-surface/90 shadow-sm backdrop-blur-[20px]">
      <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-card">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path d="M12 3L4 7v5c0 4.4 3.4 8.5 8 9.5 4.6-1 8-5.1 8-9.5V7l-8-4z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-foreground"/>
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-foreground"/>
              </svg>
          </div>
          {centerSlot && (
            <div>{centerSlot}</div>
          )}
          <button
            onClick={() => navigate('/events')}
            className="flex items-center gap-3 group"
          >
            {!centerSlot && (
              <div className="hidden sm:flex flex-col items-end leading-none">
                <span className="text-sm font-bold text-primary tracking-tight">Gamify</span>
                <span className="text-[10px] text-muted font-medium tracking-wide">PLATFORM</span>
              </div>
            )}

          </button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isSuperAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground transition-colors"
            >
              <Shield size={16} />
              <span className="hidden sm:inline">ניהול</span>
            </button>
          )}

          <div className="relative flex items-center" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="rounded-full hover:ring-2 hover:ring-border transition-all"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-border" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-muted ring-2 ring-border">
                  {displayName[0]?.toUpperCase()}
                </div>
              )}
            </button>

            {menuOpen && (
              <div className="absolute left-0 top-full mt-2 w-52 rounded-xl border border-border bg-surface shadow-dropdown overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-border text-right">
                  {avatarUrl && (
                    <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover mb-2" />
                  )}
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); signOut() }}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-surface-elevated hover:text-danger transition-colors"
                >
                  <span>התנתקות</span>
                  <LogOut size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
