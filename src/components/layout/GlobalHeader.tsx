import { useState, useRef, useEffect, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, LogOut, Shield, Sparkles } from 'lucide-react'
import { BrandLogo, BrandWordmark } from '@/components/icons/BrandLogo'
import { useAuth } from '@/contexts/AuthContext'
import { HeaderSlotContext } from '@/contexts/HeaderSlotContext'
import { usePlansModal } from '@/contexts/PlansModalContext'
import { trackCtaClick } from '@/lib/analytics'

export function GlobalHeader() {
  const { user, profile, signOut, isSuperAdmin } = useAuth()
  const headerSlot = useContext(HeaderSlotContext)
  const centerSlot = headerSlot?.centerSlot ?? null
  const currentPlan = headerSlot?.currentPlan ?? null
  const currentEventId = headerSlot?.currentEventId ?? null
  const headerActivationCta = headerSlot?.headerActivationCta ?? null
  const suppressHeaderActivationCta = headerSlot?.suppressHeaderActivationCta ?? false
  const { openPlans } = usePlansModal()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const showActivationCta = headerActivationCta
    ? headerActivationCta.visible
    : currentPlan === 'free' && !suppressHeaderActivationCta

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

  return (
    <header className="sticky top-0 z-40 bg-surface/90 shadow-sm backdrop-blur-[20px]">
      <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <button
            onClick={() => navigate('/welcome')}
            className="group flex shrink-0 items-center"
          >
            {centerSlot ? (
              <BrandLogo />
            ) : (
              <>
                <BrandWordmark className="hidden sm:inline-flex" />
                <BrandLogo className="sm:hidden" />
              </>
            )}
          </button>
          {centerSlot && (
            <div className="flex min-w-0 items-center">{centerSlot}</div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <>
              {showActivationCta && (
                <button
                  type="button"
                  onClick={() => {
                    if (headerActivationCta) {
                      headerActivationCta.onClick()
                      return
                    }
                    trackCtaClick({
                      cta_name: 'view_pricing',
                      cta_location: 'header',
                      destination: 'plans_modal',
                    })
                    openPlans({ eventId: currentEventId })
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
                >
                  <Sparkles size={16} />
                  <span className="hidden sm:inline">הפעלת המשחק</span>
                </button>
              )}

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
                      onClick={() => {
                        setMenuOpen(false)
                        navigate('/events')
                      }}
                      className="flex w-full items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-surface-elevated transition-colors"
                    >
                      <span>האירועים שלי</span>
                      <CalendarDays size={15} />
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); signOut().then(() => navigate('/welcome')) }}
                      className="flex w-full items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-surface-elevated hover:text-danger transition-colors border-t border-border"
                    >
                      <span>התנתקות</span>
                      <LogOut size={15} />
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              to="/login"
              onClick={() =>
                trackCtaClick({
                  cta_name: 'login',
                  cta_location: 'header',
                  destination: '/login',
                })
              }
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              התחברות
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
