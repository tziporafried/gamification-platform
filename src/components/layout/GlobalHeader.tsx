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
    <header className="sticky top-0 z-40 backdrop-blur-sm" style={{ background: 'linear-gradient(315deg, #3b0764 0%, #1e0a3c 50%, #0f0b1e 100%)', borderBottom: '1px solid rgba(139,92,246,0.4)', boxShadow: '0 4px 24px rgba(124,58,237,0.25)' }}>
      <div className="flex h-14 w-full items-center justify-between px-4">
        {/* RIGHT side: Logo + breadcrumb */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl gradient-brand shadow-lg shadow-brand-600/30 group-hover:shadow-brand-500/50 transition-shadow">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path d="M12 3L4 7v5c0 4.4 3.4 8.5 8 9.5 4.6-1 8-5.1 8-9.5V7l-8-4z" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
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
                <span className="text-sm font-bold text-white tracking-tight">Gamify</span>
                <span className="text-[10px] text-brand-400 font-medium tracking-wide">PLATFORM</span>
              </div>
            )}

          </button>
        </div>

        {/* LEFT side: admin + profile */}
        <div className="flex items-center gap-3 shrink-0">
          {isSuperAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Shield size={16} />
              <span className="hidden sm:inline">ניהול</span>
            </button>
          )}

          <div className="relative flex items-center" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="rounded-full hover:ring-2 hover:ring-brand-500/50 transition-all"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-brand-500/30" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600/30 text-xs font-bold text-brand-300 ring-2 ring-brand-500/30">
                  {displayName[0]?.toUpperCase()}
                </div>
              )}
            </button>

            {menuOpen && (
              <div className="absolute left-0 top-full mt-2 w-52 rounded-xl border border-game-border bg-game-card shadow-xl shadow-black/40 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-game-border text-right">
                  {avatarUrl && (
                    <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover mb-2" />
                  )}
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); signOut() }}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-red-400 transition-colors"
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
