import { Award } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { AvatarCircle } from '@/components/ui/AvatarCircle'

interface RecentRewardEntry {
  id: string
  participantName: string
  rewardName: string
  awardedAt: string
}

interface RecentRewardsProps {
  entries: RecentRewardEntry[]
}

export function RecentRewards({ entries }: RecentRewardsProps) {
  if (entries.length === 0) return null

  return (
    <div className="rounded-2xl border border-game-border bg-game-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-game-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20">
          <Award size={18} className="text-amber-400" />
        </div>
        <h3 className="text-base font-bold text-white">Recently Unlocked</h3>
      </div>

      <div className="divide-y divide-game-border/50">
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 px-5 py-3 opacity-0 animate-fade-in-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <AvatarCircle name={entry.participantName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-gray-300">
                <span className="font-medium text-white">{entry.participantName}</span>
                <span className="text-gray-500"> unlocked </span>
                <span className="font-semibold text-amber-400">{entry.rewardName}</span>
              </p>
            </div>
            <span className="shrink-0 text-xs text-gray-500">
              {formatDistanceToNow(new Date(entry.awardedAt), { addSuffix: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
