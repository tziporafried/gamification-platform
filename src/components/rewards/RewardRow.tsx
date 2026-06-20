import { Trophy, Star, Award, Gem } from 'lucide-react'
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

function getRewardTier(points: number): { icon: typeof Trophy; gradient: string; label: string } {
  if (points >= 2000) return { icon: Gem, gradient: 'from-violet-500 to-purple-600', label: 'Diamond' }
  if (points >= 1000) return { icon: Trophy, gradient: 'from-amber-500 to-yellow-500', label: 'Gold' }
  if (points >= 500) return { icon: Award, gradient: 'from-gray-400 to-gray-500', label: 'Silver' }
  return { icon: Star, gradient: 'from-orange-500 to-amber-600', label: 'Bronze' }
}

export function RewardRow({ reward, onEdit, onToggleActive, onManageGroups }: RewardRowProps) {
  const tier = getRewardTier(reward.required_points)
  const TierIcon = tier.icon

  return (
    <div
      className={cn(
        'group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5',
        !reward.is_active && 'opacity-60',
      )}
    >
      <div className={cn('h-1.5 bg-gradient-to-r', tier.gradient)} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white',
              tier.gradient,
            )}
          >
            <TierIcon size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-gray-900">{reward.name}</p>
              {!reward.is_active && (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                  Inactive
                </span>
              )}
            </div>
            {reward.description && (
              <p className="mt-0.5 truncate text-xs text-gray-500">{reward.description}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-lg bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                {reward.required_points.toLocaleString()} pts
              </span>
              {reward.groups.length > 0 ? (
                reward.groups.map((g) => (
                  <Badge key={g.id} label={g.name} color={g.color} />
                ))
              ) : (
                <span className="text-[11px] text-gray-400">All participants</span>
              )}
            </div>
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
      </div>
    </div>
  )
}
