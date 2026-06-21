import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { Badge } from '@/components/ui/Badge'
import { XPBar } from '@/components/ui/XPBar'
import type { Group } from '@/types'

interface ParticipantPreviewProps {
  name: string
  externalId: string
  totalPoints: number
  rank: number | null
  groups: Group[]
  nextReward: { name: string; required_points: number } | null
}

export function ParticipantPreview({
  name,
  externalId,
  totalPoints,
  rank,
  groups,
  nextReward,
}: ParticipantPreviewProps) {
  const primaryGroupColor = groups.length > 0 ? groups[0].color : undefined

  return (
    <div className="mt-2 rounded-xl border border-brand-500/20 bg-brand-500/10 p-3 animate-slide-up">
      <div className="flex items-center gap-3">
        <AvatarCircle name={name} size="md" ringColor={primaryGroupColor} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">{name}</p>
            <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-gray-400">
              {externalId}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xs font-bold text-brand-400">
              {totalPoints.toLocaleString()} pts
            </span>
            {rank !== null && (
              <span className="text-xs text-gray-500">
                #{rank} rank
              </span>
            )}
          </div>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {groups.map((g) => (
            <Badge key={g.id} label={g.name} color={g.color} />
          ))}
        </div>
      )}

      {nextReward && (
        <div className="mt-2.5">
          <XPBar
            current={totalPoints}
            target={nextReward.required_points}
            label={`${(nextReward.required_points - totalPoints).toLocaleString()} pts to "${nextReward.name}"`}
          />
        </div>
      )}
    </div>
  )
}
