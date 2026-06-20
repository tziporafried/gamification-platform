import { Trophy, ChevronRight } from 'lucide-react'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { RankBadge } from '@/components/ui/RankBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Group } from '@/types'

interface LeaderboardEntry {
  participant_id: string
  participant_name: string
  external_id: string
  total_points: number
  rank: number
  groups: Group[]
}

interface HomeLeaderboardProps {
  entries: LeaderboardEntry[]
  themeColor: string
  onViewFull: () => void
}

const HIGHLIGHT_BG: Record<number, string> = {
  1: 'bg-amber-50/60',
  2: 'bg-gray-50/60',
  3: 'bg-orange-50/40',
}

export function HomeLeaderboard({ entries, themeColor, onViewFull }: HomeLeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-card">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: themeColor + '14' }}
          >
            <Trophy size={18} style={{ color: themeColor }} />
          </div>
          <h3 className="text-base font-bold text-gray-900">Leaderboard</h3>
        </div>
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-gray-500">No scores recorded yet. Start awarding points to see rankings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: themeColor + '14' }}
          >
            <Trophy size={18} style={{ color: themeColor }} />
          </div>
          <h3 className="text-base font-bold text-gray-900">Leaderboard</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
            Top {entries.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {entries.map((entry, index) => {
          const highlightBg = HIGHLIGHT_BG[entry.rank] || ''
          return (
            <div
              key={entry.participant_id}
              className={cn(
                'flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50/80',
                highlightBg,
                'opacity-0 animate-fade-in-up',
              )}
              style={{ animationDelay: `${index * 0.04}s` }}
            >
              <RankBadge rank={entry.rank} size="sm" />
              <AvatarCircle
                name={entry.participant_name}
                size="sm"
                ringColor={entry.groups[0]?.color}
              />
              <div className="min-w-0 flex-1">
                <p className={cn(
                  'truncate text-sm text-gray-900',
                  entry.rank <= 3 ? 'font-bold' : 'font-medium',
                )}>
                  {entry.participant_name}
                </p>
              </div>
              {entry.groups.length > 0 && (
                <div className="hidden sm:flex gap-1">
                  {entry.groups.slice(0, 2).map((g) => (
                    <Badge key={g.id} label={g.name} color={g.color} />
                  ))}
                </div>
              )}
              <span
                className={cn(
                  'shrink-0 tabular-nums text-sm',
                  entry.rank <= 3 ? 'font-bold' : 'font-semibold',
                )}
                style={{ color: themeColor }}
              >
                {entry.total_points.toLocaleString()}
                <span className="ml-0.5 text-xs font-medium opacity-60">pts</span>
              </span>
            </div>
          )
        })}
      </div>

      <div className="border-t border-gray-100 px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewFull}
          className="w-full justify-center gap-1 text-brand-600 hover:text-brand-700 hover:bg-brand-50"
        >
          View Full Leaderboard
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  )
}
