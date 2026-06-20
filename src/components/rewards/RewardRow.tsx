import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { RewardWithGroups } from '@/types'

interface RewardRowProps {
  reward: RewardWithGroups
  onEdit: () => void
  onToggleActive: () => void
  onManageGroups: () => void
}

export function RewardRow({ reward, onEdit, onToggleActive, onManageGroups }: RewardRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm',
        !reward.is_active && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="shrink-0 inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            {reward.required_points} pts
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{reward.name}</p>
            {reward.description && (
              <p className="truncate text-xs text-gray-500">{reward.description}</p>
            )}
          </div>
        </div>
        {reward.groups.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {reward.groups.map((g) => (
              <Badge key={g.id} label={g.name} color={g.color} />
            ))}
          </div>
        )}
        {reward.groups.length === 0 && (
          <p className="mt-1 text-xs text-gray-400">Available to all participants</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="sm" onClick={onManageGroups}>Groups</Button>
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleActive}
          className={reward.is_active ? 'text-amber-600 hover:bg-amber-50 hover:text-amber-700' : 'text-green-600 hover:bg-green-50 hover:text-green-700'}
        >
          {reward.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </div>
  )
}
