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
  { key: 'actions', label: 'Actions', icon: Zap },
  { key: 'rewards', label: 'Rewards', icon: Trophy },
  { key: 'groups', label: 'Groups', icon: Layers },
  { key: 'event', label: 'Event Settings', icon: Settings },
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in-up"
        style={{ animationDuration: '0.15s' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-10 animate-slide-up rounded-t-2xl bg-white shadow-podium"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={18} />
        </button>

        {/* Nav items */}
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
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <Icon
                      size={20}
                      className={isActive ? 'text-brand-600' : 'text-gray-400'}
                    />
                    {label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AvatarCircle name={userName} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{userName}</p>
                <p className="truncate text-xs text-gray-500">{userEmail}</p>
              </div>
            </div>
            <button
              onClick={() => { onSignOut(); onClose() }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            >
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
