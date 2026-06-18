import { useCountUp } from '@/hooks/useCountUp'

const MEDAL_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
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
  const displayPoints = useCountUp(totalPoints)
  const medalColor = MEDAL_COLORS[rank]
  const isFirst = rank === 1

  return (
    <div
      className="opacity-0 animate-scale-in flex flex-col items-center rounded-xl border border-gray-200 bg-white shadow-sm transition-transform hover:scale-105"
      style={{
        animationDelay: `${animationDelay}s`,
        boxShadow: isFirst ? `0 4px 20px ${themeColor}26` : undefined,
      }}
    >
      <div
        className="h-1.5 w-full rounded-t-xl"
        style={{ backgroundColor: color || medalColor }}
      />
      <div className="flex w-full flex-col items-center px-4 pb-5 pt-4">
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold"
          style={{
            backgroundColor: medalColor + '33',
            color: medalColor,
          }}
        >
          {MEDAL_LABELS[rank]}
        </div>
        <p className="w-full truncate text-center text-sm font-semibold text-gray-900">
          {name}
        </p>
        {detail && (
          <p className="w-full truncate text-center text-xs text-gray-500">
            {detail}
          </p>
        )}
        <p className="mt-2 text-xl font-bold" style={{ color: themeColor }}>
          {displayPoints} <span className="text-sm font-medium">pts</span>
        </p>
      </div>
    </div>
  )
}
