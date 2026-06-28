import { cn } from '@/lib/utils'

export type LeaderboardView = 'participants' | 'groups'

interface LeaderboardToggleProps {
  activeView: LeaderboardView
  onViewChange: (view: LeaderboardView) => void
}

export function LeaderboardToggle({ activeView, onViewChange }: LeaderboardToggleProps) {
  return (
    <div className="inline-flex rounded-lg bg-white/10 p-1">
      <button
        onClick={() => onViewChange('participants')}
        className={cn(
          'rounded-md px-4 py-2 text-sm font-medium transition-colors',
          activeView === 'participants'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-gray-400 hover:text-gray-200',
        )}
      >
        שחקנים
      </button>
      <button
        onClick={() => onViewChange('groups')}
        className={cn(
          'rounded-md px-4 py-2 text-sm font-medium transition-colors',
          activeView === 'groups'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-gray-400 hover:text-gray-200',
        )}
      >
        קבוצות
      </button>
    </div>
  )
}
