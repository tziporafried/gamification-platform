import { Trophy } from 'lucide-react'

interface LeaderboardEmptyStateProps {
  themeColor: string
  message?: string
}

export function LeaderboardEmptyState({ themeColor, message }: LeaderboardEmptyStateProps) {
  return (
    <div className="opacity-0 animate-fade-in-up flex flex-col items-center justify-center rounded-2xl border border-game-border bg-game-card/50 px-6 py-16 text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: themeColor + '20' }}
      >
        <Trophy size={32} style={{ color: themeColor }} />
      </div>
      <h3 className="text-lg font-bold text-white">
        Arena Ready
      </h3>
      <p className="mt-2 max-w-sm text-sm text-gray-400">
        {message || 'No scores have been recorded yet. Start awarding points to see the first rankings appear.'}
      </p>
    </div>
  )
}
