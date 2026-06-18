import { PodiumPlace } from './PodiumPlace'

interface PodiumEntry {
  rank: 1 | 2 | 3
  name: string
  detail?: string
  color?: string
  total_points: number
}

interface LeaderboardPodiumProps {
  entries: PodiumEntry[]
  themeColor: string
}

export function LeaderboardPodium({ entries, themeColor }: LeaderboardPodiumProps) {
  if (entries.length === 0) return null

  const first = entries.find((e) => e.rank === 1)
  const second = entries.find((e) => e.rank === 2)
  const third = entries.find((e) => e.rank === 3)

  return (
    <div className="mb-6">
      {/* Desktop: 2nd | 1st (elevated) | 3rd */}
      <div className="hidden sm:grid sm:grid-cols-3 sm:items-end sm:gap-4">
        <div className="pt-6">
          {second && (
            <PodiumPlace
              rank={2}
              name={second.name}
              detail={second.detail}
              color={second.color}
              totalPoints={second.total_points}
              themeColor={themeColor}
              animationDelay={0.15}
            />
          )}
        </div>
        <div>
          {first && (
            <PodiumPlace
              rank={1}
              name={first.name}
              detail={first.detail}
              color={first.color}
              totalPoints={first.total_points}
              themeColor={themeColor}
              animationDelay={0}
            />
          )}
        </div>
        <div className="pt-6">
          {third && (
            <PodiumPlace
              rank={3}
              name={third.name}
              detail={third.detail}
              color={third.color}
              totalPoints={third.total_points}
              themeColor={themeColor}
              animationDelay={0.3}
            />
          )}
        </div>
      </div>

      {/* Mobile: stacked 1st → 2nd → 3rd */}
      <div className="flex flex-col gap-3 sm:hidden">
        {entries.map((entry) => (
          <PodiumPlace
            key={entry.rank}
            rank={entry.rank}
            name={entry.name}
            detail={entry.detail}
            color={entry.color}
            totalPoints={entry.total_points}
            themeColor={themeColor}
            animationDelay={entry.rank * 0.1}
          />
        ))}
      </div>
    </div>
  )
}
