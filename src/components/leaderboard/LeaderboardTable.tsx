import { LeaderboardRow } from './LeaderboardRow'

interface TableEntry {
  rank: number
  name: string
  detail?: string
  color?: string
  total_points: number
}

interface LeaderboardTableProps {
  entries: TableEntry[]
  themeColor: string
}

export function LeaderboardTable({ entries, themeColor }: LeaderboardTableProps) {
  if (entries.length === 0) return null

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <LeaderboardRow
          key={`${entry.rank}-${entry.name}`}
          rank={entry.rank}
          name={entry.name}
          detail={entry.detail}
          color={entry.color}
          totalPoints={entry.total_points}
          themeColor={themeColor}
          animationDelay={index * 0.05}
        />
      ))}
    </div>
  )
}
