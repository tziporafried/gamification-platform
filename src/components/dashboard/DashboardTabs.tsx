import { cn } from '@/lib/utils'
import type { DashboardTab } from '@/types'

interface DashboardTabsProps {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  participantCount: number
  groupCount: number
  actionCount: number
}

const TABS: { key: DashboardTab; label: string }[] = [
  { key: 'event', label: 'Event' },
  { key: 'participants', label: 'Participants' },
  { key: 'groups', label: 'Groups' },
  { key: 'actions', label: 'Actions' },
  { key: 'score', label: 'Score' },
  { key: 'leaderboard', label: 'Leaderboards' },
]

export function DashboardTabs({ activeTab, onTabChange, participantCount, groupCount, actionCount }: DashboardTabsProps) {
  function getCount(key: DashboardTab): number | null {
    if (key === 'participants') return participantCount
    if (key === 'groups') return groupCount
    if (key === 'actions') return actionCount
    return null
  }

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
        {TABS.map(({ key, label }) => {
          const count = getCount(key)
          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={cn(
                'whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors',
                activeTab === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )}
            >
              {label}
              {count !== null && (
                <span
                  className={cn(
                    'ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    activeTab === key
                      ? 'bg-indigo-100 text-indigo-600'
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
