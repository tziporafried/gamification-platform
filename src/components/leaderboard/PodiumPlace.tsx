import { Crown, Medal } from 'lucide-react'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { cn } from '@/lib/utils'

const MEDAL_COLORS: Record<number, string> = {
  1: '#fbbf24',
  2: '#9ca3af',
  3: '#d97706',
}

const PODIUM_STYLES: Record<number, { gradient: string; height: string; glow: string }> = {
  1: {
    gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    height: 'pt-6 pb-6',
    glow: 'glow-border-gold',
  },
  2: {
    gradient: 'from-gray-400/10 via-gray-300/5 to-transparent',
    height: 'pt-5 pb-5',
    glow: '',
  },
  3: {
    gradient: 'from-orange-500/10 via-amber-500/5 to-transparent',
    height: 'pt-5 pb-5',
    glow: '',
  },
}

interface PodiumPlaceProps {
  rank: 1 | 2 | 3
  name: string
  detail?: string
  color?: string
  totalPoints: number
  animationDelay: number
}

export function PodiumPlace({
  rank,
  name,
  detail,
  color,
  totalPoints,
  animationDelay,
}: PodiumPlaceProps) {
  const medalColor = MEDAL_COLORS[rank]
  const style = PODIUM_STYLES[rank]
  const isFirst = rank === 1

  return (
    <div
      className={cn(
        'opacity-0 animate-scale-in flex flex-col items-center rounded-2xl border border-game-border bg-game-card overflow-hidden transition-all duration-300',
        style.glow,
      )}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div
        className={cn(
          'flex w-full flex-col items-center px-4 bg-gradient-to-b',
          style.gradient,
          style.height,
        )}
      >
        {isFirst && (
          <Crown
            size={28}
            className="mb-2 animate-crown-glow"
            style={{ color: '#fbbf24' }}
            fill="#fbbf24"
          />
        )}

        <div className="relative mb-3">
          <AvatarCircle
            name={name}
            size={isFirst ? 'lg' : 'md'}
            ringColor={color || medalColor}
          />
          <div
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-lg"
            style={{ backgroundColor: medalColor }}
          >
            {rank}
          </div>
        </div>

        <p className={cn(
          'w-full truncate text-center font-bold',
          isFirst ? 'text-base text-white' : 'text-sm text-gray-200',
        )}>
          {name}
        </p>
        {detail && (
          <p className="w-full truncate text-center text-xs text-gray-500">
            {detail}
          </p>
        )}

        <div className="mt-3 flex items-baseline gap-1">
          <AnimatedCounter
            value={totalPoints}
            className={cn(
              'font-bold',
              isFirst ? 'text-3xl text-amber-400' : 'text-2xl text-gray-200',
            )}
            duration={1500}
          />
          <span className={cn(
            'text-sm font-medium',
            isFirst ? 'text-amber-500/60' : 'text-gray-500',
          )}>
            נק׳
          </span>
        </div>

        <span
          className="mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold"
          style={{
            backgroundColor: medalColor + '20',
            color: medalColor,
          }}
        >
          {rank <= 2 && <Medal size={11} />}
          {rank === 1 ? 'אלוף' : rank === 2 ? 'סגן אלוף' : 'מקום שלישי'}
        </span>
      </div>
    </div>
  )
}
