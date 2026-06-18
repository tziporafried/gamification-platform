import { cn } from '@/lib/utils'

export type LeaderboardView = 'participants' | 'groups'

interface LeaderboardToggleProps {
  activeView: LeaderboardView
  onViewChange: (view: LeaderboardView) => void
  themeColor: string
}

export function LeaderboardToggle({ activeView, onViewChange, themeColor }: LeaderboardToggleProps) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-1">
      <button
        onClick={() => onViewChange('participants')}
        className={cn(
          'rounded-md px-4 py-2 text-sm font-medium transition-colors',
          activeView === 'participants'
            ? 'bg-white shadow-sm'
            : 'text-gray-500 hover:text-gray-700',
        )}
        style={activeView === 'participants' ? { color: themeColor } : undefined}
      >
        Participants
      </button>
      <button
        onClick={() => onViewChange('groups')}
        className={cn(
          'rounded-md px-4 py-2 text-sm font-medium transition-colors',
          activeView === 'groups'
            ? 'bg-white shadow-sm'
            : 'text-gray-500 hover:text-gray-700',
        )}
        style={activeView === 'groups' ? { color: themeColor } : undefined}
      >
        Groups
      </button>
    </div>
  )
}
