import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Zap, Trophy, Layers, Settings, LogOut, X } from 'lucide-react'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { cn } from '@/lib/utils'
import type { DashboardTab } from '@/types'

interface MoreDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  userName: string
  userEmail: string
  onSignOut: () => void
}

const DRAWER_ITEMS: { key: DashboardTab; label: string; icon: typeof Settings }[] = [
  { key: 'actions', label: 'משימות', icon: Zap },
  { key: 'rewards', label: 'פרסים', icon: Trophy },
  { key: 'groups', label: 'קבוצות', icon: Layers },
  { key: 'event', label: 'הגדרות אירוע', icon: Settings },
]

export function MoreDrawer({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  userName,
  userEmail,
  onSignOut,
}: MoreDrawerProps) {
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  function handleNav(tab: DashboardTab) {
    onTabChange(tab)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="fixed inset-x-0 bottom-0 z-10 animate-slide-up rounded-t-2xl bg-game-dark shadow-podium border-t border-game-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-600" />
        </div>

        <button
          onClick={onClose}
          className="absolute left-4 top-4 rounded-lg p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300"
        >
          <X size={18} />
        </button>

        <nav className="px-4 pt-2 pb-2">
          <ul className="space-y-0.5">
            {DRAWER_ITEMS.map(({ key, label, icon: Icon }) => {
              const isActive = activeTab === key
              return (
                <li key={key}>
                  <button
                    onClick={() => handleNav(key)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-600/20 text-white'
                        : 'text-gray-300 hover:bg-white/5',
                    )}
                  >
                    <Icon
                      size={20}
                      className={isActive ? 'text-brand-400' : 'text-gray-500'}
                    />
                    {label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-game-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AvatarCircle name={userName} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-200">{userName}</p>
                <p className="truncate text-xs text-gray-500">{userEmail}</p>
              </div>
            </div>
            <button
              onClick={() => { onSignOut(); onClose() }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-white/5 hover:text-gray-300"
            >
              <LogOut size={16} />
              התנתקות
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
