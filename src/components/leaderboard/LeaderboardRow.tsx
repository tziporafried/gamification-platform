import { cn } from '@/lib/utils'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { RankBadge } from '@/components/ui/RankBadge'

interface LeaderboardRowProps {
  rank: number
  name: string
  detail?: string
  color?: string
  totalPoints: number
  themeColor?: string
  animationDelay: number
}

export function LeaderboardRow({
  rank,
  name,
  detail,
  color,
  totalPoints,
  animationDelay,
}: LeaderboardRowProps) {
  return (
    <div
      className={cn(
        'opacity-0 animate-fade-in-up',
        'flex items-center gap-3 rounded-xl px-4 py-3',
        'bg-game-card/50 border border-game-border/50',
        'transition-all duration-200 hover:bg-game-card hover:border-game-border',
      )}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <RankBadge rank={rank} size="sm" />

      <AvatarCircle name={name} size="sm" ringColor={color} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-200">{name}</p>
        {detail && (
          <p className="truncate text-xs text-gray-500">{detail}</p>
        )}
      </div>

      <span className="shrink-0 text-sm font-bold tabular-nums text-brand-400">
        {totalPoints.toLocaleString()}
        <span className="mr-0.5 text-xs font-medium text-brand-500/50">נק׳</span>
      </span>
    </div>
  )
}
