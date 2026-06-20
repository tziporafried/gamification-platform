import { Crown, Medal } from 'lucide-react'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'

const MEDAL_COLORS: Record<number, string> = {
  1: '#d97706',
  2: '#6b7280',
  3: '#c2410c',
}

const MEDAL_GRADIENTS: Record<number, string> = {
  1: 'gradient-gold',
  2: 'gradient-silver',
  3: 'gradient-bronze',
}

const MEDAL_LABELS: Record<number, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
}

interface PodiumPlaceProps {
  rank: 1 | 2 | 3
  name: string
  detail?: string
  color?: string
  totalPoints: number
  themeColor: string
  animationDelay: number
}

export function PodiumPlace({
  rank,
  name,
  detail,
  color,
  totalPoints,
  themeColor,
  animationDelay,
}: PodiumPlaceProps) {
  const medalColor = MEDAL_COLORS[rank]
  const isFirst = rank === 1

  return (
    <div
      className="opacity-0 animate-scale-in flex flex-col items-center rounded-2xl border border-gray-100 bg-white shadow-card transition-all duration-200 hover:shadow-card-hover overflow-hidden"
      style={{
        animationDelay: `${animationDelay}s`,
        boxShadow: isFirst ? `0 8px 32px ${themeColor}20` : undefined,
      }}
    >
      <div className={`h-1.5 w-full ${MEDAL_GRADIENTS[rank]}`} />

      <div className="flex w-full flex-col items-center px-4 pb-5 pt-5">
        {isFirst && (
          <Crown
            size={24}
            className="mb-2 text-amber-500"
            fill="#f59e0b"
          />
        )}

        <div className="relative mb-3">
          <AvatarCircle
            name={name}
            size={isFirst ? 'lg' : 'md'}
            ringColor={color || medalColor}
          />
          <div
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: medalColor }}
          >
            {rank}
          </div>
        </div>

        <p className="w-full truncate text-center text-sm font-semibold text-gray-900">
          {name}
        </p>
        {detail && (
          <p className="w-full truncate text-center text-xs text-gray-500">
            {detail}
          </p>
        )}

        <div className="mt-2 flex items-baseline gap-1">
          <AnimatedCounter
            value={totalPoints}
            className={`${isFirst ? 'text-2xl' : 'text-xl'} font-bold`}
            suffix="pts"
            duration={1500}
          />
        </div>

        <span
          className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: medalColor + '18',
            color: medalColor,
          }}
        >
          {rank <= 2 && <Medal size={10} />}
          {MEDAL_LABELS[rank]} Place
        </span>
      </div>
    </div>
  )
}
