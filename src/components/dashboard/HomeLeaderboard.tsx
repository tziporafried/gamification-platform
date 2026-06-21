import { Trophy, ChevronLeft } from 'lucide-react'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { RankBadge } from '@/components/ui/RankBadge'
import { Badge } from '@/components/ui/Badge'
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

export function HomeLeaderboard({ entries, onViewFull }: HomeLeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-game-border bg-game-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-game-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20">
            <Trophy size={18} className="text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-white">טבלת דירוג</h3>
        </div>
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-gray-500">עדיין לא נרשמו ניקודים. התחילו להעניק ניקוד כדי לראות דירוגים.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-game-border bg-game-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-game-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20">
            <Trophy size={18} className="text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-white">טבלת דירוג</h3>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
            טופ {entries.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-game-border/50">
        {entries.map((entry, index) => {
          const isTop3 = entry.rank <= 3
          return (
            <div
              key={entry.participant_id}
              className={cn(
                'flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/5',
                isTop3 && entry.rank === 1 && 'bg-amber-500/5',
                isTop3 && entry.rank === 2 && 'bg-gray-400/5',
                isTop3 && entry.rank === 3 && 'bg-orange-500/5',
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
                  'truncate text-sm',
                  isTop3 ? 'font-bold text-white' : 'font-medium text-gray-300',
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
                  isTop3 ? 'font-bold text-amber-400' : 'font-semibold text-brand-400',
                )}
              >
                {entry.total_points.toLocaleString()}
                <span className="mr-0.5 text-xs font-medium opacity-50">נק׳</span>
              </span>
            </div>
          )
        })}
      </div>

      <div className="border-t border-game-border px-5 py-3">
        <button
          onClick={onViewFull}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-brand-400 transition-colors hover:bg-brand-600/10 hover:text-brand-300"
        >
          צפייה בטבלת הדירוג המלאה
          <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  )
}
