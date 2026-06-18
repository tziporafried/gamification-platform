import { cn } from '@/lib/utils'

const MEDAL_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
}

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
  const medalColor = MEDAL_COLORS[rank]

  return (
    <div
      className={cn(
        'opacity-0 animate-fade-in-up',
        'flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm',
        'transition-shadow hover:shadow-md',
      )}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <span
        className="w-8 text-center text-sm font-bold"
        style={{ color: medalColor || '#9ca3af' }}
      >
        #{rank}
      </span>
      {color && (
        <div
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{name}</p>
        {detail && (
          <p className="truncate text-xs text-gray-500">{detail}</p>
        )}
      </div>
      <span
        className="shrink-0 text-sm font-semibold"
        style={{ color: themeColor }}
      >
        {totalPoints} pts
      </span>
    </div>
  )
}
