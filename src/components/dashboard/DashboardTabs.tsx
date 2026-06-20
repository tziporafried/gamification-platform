import { cn } from '@/lib/utils'
import { Settings, Users, Layers, Zap, Trophy, Target, BarChart3 } from 'lucide-react'
import type { DashboardTab } from '@/types'

interface DashboardTabsProps {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  participantCount: number
  groupCount: number
  actionCount: number
  rewardCount: number
}

const TABS: { key: DashboardTab; label: string; icon: typeof Settings }[] = [
  { key: 'event', label: 'Event', icon: Settings },
  { key: 'participants', label: 'Participants', icon: Users },
  { key: 'groups', label: 'Groups', icon: Layers },
  { key: 'actions', label: 'Actions', icon: Zap },
  { key: 'rewards', label: 'Rewards', icon: Trophy },
  { key: 'score', label: 'Score', icon: Target },
  { key: 'leaderboard', label: 'Leaderboard', icon: BarChart3 },
]

export function DashboardTabs({ activeTab, onTabChange, participantCount, groupCount, actionCount, rewardCount }: DashboardTabsProps) {
  function getCount(key: DashboardTab): number | null {
    if (key === 'participants') return participantCount
    if (key === 'groups') return groupCount
    if (key === 'actions') return actionCount
    if (key === 'rewards') return rewardCount
    return null
  }

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Tabs">
        {TABS.map(({ key, label, icon: Icon }) => {
          const count = getCount(key)
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors',
                isActive
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )}
            >
              <Icon size={15} className={isActive ? 'text-brand-500' : 'text-gray-400'} />
              <span className="hidden sm:inline">{label}</span>
              {count !== null && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    isActive
                      ? 'bg-brand-100 text-brand-600'
                      : 'bg-gray-100 text-gray-600',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
