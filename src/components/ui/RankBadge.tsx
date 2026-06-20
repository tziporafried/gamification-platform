import { Crown, Medal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RankBadgeProps {
  rank: number
  size?: 'sm' | 'md'
  className?: string
}

const MEDAL_STYLES: Record<number, { bg: string; text: string; color: string }> = {
  1: { bg: 'bg-amber-100', text: 'text-amber-700', color: '#d97706' },
  2: { bg: 'bg-gray-100', text: 'text-gray-600', color: '#6b7280' },
  3: { bg: 'bg-orange-100', text: 'text-orange-700', color: '#c2410c' },
}

export function RankBadge({ rank, size = 'md', className }: RankBadgeProps) {
  const medal = MEDAL_STYLES[rank]
  const iconSize = size === 'sm' ? 14 : 16
  const containerSize = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'

  if (rank === 1) {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          containerSize,
          medal.bg,
          className,
        )}
      >
        <Crown size={iconSize} className={medal.text} fill={medal.color} />
      </div>
    )
  }

  if (rank <= 3) {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          containerSize,
          medal.bg,
          className,
        )}
      >
        <Medal size={iconSize} className={medal.text} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-gray-50 font-semibold text-gray-500',
        containerSize,
        size === 'sm' ? 'text-xs' : 'text-sm',
        className,
      )}
    >
      {rank}
    </div>
  )
}
