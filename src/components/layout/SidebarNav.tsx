import { Home, BarChart3, Target, Users, Zap, Trophy, Layers, Settings, LogOut } from 'lucide-react'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { cn } from '@/lib/utils'
import type { DashboardTab } from '@/types'

interface SidebarNavProps {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  eventName: string
  eventLogoUrl: string | null
  userName: string
  userEmail: string
  onSignOut: () => void
}

const NAV_ITEMS: { key: DashboardTab; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'leaderboard', label: 'Leaderboard', icon: BarChart3 },
  { key: 'score', label: 'Score', icon: Target },
  { key: 'participants', label: 'Participants', icon: Users },
  { key: 'actions', label: 'Actions', icon: Zap },
  { key: 'rewards', label: 'Rewards', icon: Trophy },
  { key: 'groups', label: 'Groups', icon: Layers },
  { key: 'event', label: 'Settings', icon: Settings },
]

export function SidebarNav({
  activeTab,
  onTabChange,
  eventName,
  eventLogoUrl,
  userName,
  userEmail,
  onSignOut,
}: SidebarNavProps) {
  return (
    <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-20 md:w-16 lg:w-60 md:bg-game-dark md:border-r md:border-game-border">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-game-border px-4">
        {eventLogoUrl ? (
          <img src={eventLogoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-brand text-sm font-bold text-white">
            G
          </div>
        )}
        <span className="hidden lg:block truncate text-sm font-bold text-white">
          {eventName}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key
            return (
              <li key={key}>
                <button
                  onClick={() => onTabChange(key)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-brand-600/20 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200',
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full gradient-brand" />
                  )}
                  <Icon
                    size={20}
                    className={cn(
                      'shrink-0 transition-colors',
                      isActive ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-300',
                    )}
                  />
                  <span className="hidden lg:block">{label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-game-border p-3">
        <div className="hidden lg:flex items-center gap-2.5 rounded-lg px-2 py-2">
          <AvatarCircle name={userName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-gray-200">{userName}</p>
            <p className="truncate text-[10px] text-gray-500">{userEmail}</p>
          </div>
        </div>
        <div className="flex lg:hidden justify-center py-1">
          <AvatarCircle name={userName} size="sm" />
        </div>
        <button
          onClick={onSignOut}
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
        >
          <LogOut size={18} className="shrink-0" />
          <span className="hidden lg:block">Log Out</span>
        </button>
      </div>
    </aside>
  )
}
