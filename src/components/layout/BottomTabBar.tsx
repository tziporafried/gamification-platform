import { useState } from 'react'
import { Home, BarChart3, Target, Users, MoreHorizontal } from 'lucide-react'
import { MoreDrawer } from './MoreDrawer'
import { cn } from '@/lib/utils'
import type { DashboardTab } from '@/types'

interface BottomTabBarProps {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  userName: string
  userEmail: string
  onSignOut: () => void
}

const TABS: { key: DashboardTab; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'בית', icon: Home },
  { key: 'leaderboard', label: 'דירוג', icon: BarChart3 },
  { key: 'score', label: 'ניקוד', icon: Target },
  { key: 'participants', label: 'משתתפים', icon: Users },
]

const MORE_TABS: DashboardTab[] = ['actions', 'rewards', 'groups', 'qr-cards', 'event']

export function BottomTabBar({
  activeTab,
  onTabChange,
  userName,
  userEmail,
  onSignOut,
}: BottomTabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = MORE_TABS.includes(activeTab)

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-game-border bg-game-dark/95 backdrop-blur-sm md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <nav className="flex h-16 items-end justify-around px-2">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key
            const isScore = key === 'score'

            if (isScore) {
              return (
                <button
                  key={key}
                  onClick={() => onTabChange(key)}
                  className="flex flex-col items-center gap-0.5 -mt-3"
                >
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95',
                      isActive ? 'gradient-brand shadow-glow-brand' : 'gradient-brand animate-glow-pulse',
                    )}
                  >
                    <Icon size={22} className="text-white" />
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold',
                    isActive ? 'text-brand-400' : 'text-gray-500',
                  )}>
                    {label}
                  </span>
                </button>
              )
            }

            return (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                className="flex flex-col items-center gap-0.5 py-2"
              >
                {isActive && (
                  <div className="absolute top-0 h-0.5 w-8 rounded-full gradient-brand" />
                )}
                <Icon
                  size={22}
                  className={cn(
                    'transition-colors',
                    isActive ? 'text-brand-400' : 'text-gray-500',
                  )}
                />
                <span className={cn(
                  'text-[10px] font-medium',
                  isActive ? 'text-brand-400' : 'text-gray-500',
                )}>
                  {label}
                </span>
              </button>
            )
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2"
          >
            <MoreHorizontal
              size={22}
              className={cn(
                'transition-colors',
                isMoreActive ? 'text-brand-400' : 'text-gray-500',
              )}
            />
            <span className={cn(
              'text-[10px] font-medium',
              isMoreActive ? 'text-brand-400' : 'text-gray-500',
            )}>
              עוד
            </span>
          </button>
        </nav>
      </div>

      <MoreDrawer
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        activeTab={activeTab}
        onTabChange={onTabChange}
        userName={userName}
        userEmail={userEmail}
        onSignOut={onSignOut}
      />
    </>
  )
}
