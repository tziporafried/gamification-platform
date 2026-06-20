import { cn } from '@/lib/utils'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { RankBadge } from '@/components/ui/RankBadge'

interface LeaderboardRowProps {
  rank: number
  name: string
  detail?: string
  color?: string
  totalPoints: number
  themeColor: string
  animationDelay: number
}

export function LeaderboardRow({
  rank,
  name,
  detail,
  color,
  totalPoints,
  themeColor,
  animationDelay,
}: LeaderboardRowProps) {
  return (
    <div
      className={cn(
        'opacity-0 animate-fade-in-up',
        'flex items-center gap-3 rounded-xl bg-white px-4 py-3',
        'transition-all duration-200 hover:bg-gray-50',
      )}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <RankBadge rank={rank} size="sm" />

      <AvatarCircle name={name} size="sm" ringColor={color} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{name}</p>
        {detail && (
          <p className="truncate text-xs text-gray-500">{detail}</p>
        )}
      </div>

      <span
        className="shrink-0 text-sm font-bold tabular-nums"
        style={{ color: themeColor }}
      >
        {totalPoints.toLocaleString()} <span className="text-xs font-medium opacity-70">pts</span>
      </span>
    </div>
  )
}
