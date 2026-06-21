import { useState } from 'react'
import { Trophy, Star, Award, Gem, MoreVertical } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { RewardWithGroups } from '@/types'

interface RewardRowProps {
  reward: RewardWithGroups
  onEdit: () => void
  onToggleActive: () => void
  onManageGroups: () => void
}

function getRewardTier(points: number): { icon: typeof Trophy; gradient: string; border: string; label: string } {
  if (points >= 2000) return { icon: Gem, gradient: 'gradient-diamond', border: 'border-purple-500/30', label: 'אגדי' }
  if (points >= 1000) return { icon: Trophy, gradient: 'gradient-gold', border: 'border-amber-500/30', label: 'זהב' }
  if (points >= 500) return { icon: Award, gradient: 'gradient-silver', border: 'border-gray-400/30', label: 'כסף' }
  return { icon: Star, gradient: 'gradient-bronze', border: 'border-orange-500/30', label: 'ארד' }
}

export function RewardRow({ reward, onEdit, onToggleActive, onManageGroups }: RewardRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const tier = getRewardTier(reward.required_points)
  const TierIcon = tier.icon

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-game-card transition-all duration-200 hover:-translate-y-0.5',
        tier.border,
        !reward.is_active && 'opacity-50',
      )}
    >
      <div className="flex flex-col items-center p-5 text-center">
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl text-white mb-3',
            tier.gradient,
          )}
        >
          <TierIcon size={28} />
        </div>

        <div className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
          {tier.label}
        </div>

        <p className="w-full truncate text-sm font-bold text-white">{reward.name}</p>

        {reward.description && (
          <p className="mt-1 w-full truncate text-xs text-gray-500">{reward.description}</p>
        )}

        <div className="mt-3 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-brand-300">
          {reward.required_points.toLocaleString()} נק׳
        </div>

        {reward.groups.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {reward.groups.map((g) => (
              <Badge key={g.id} label={g.name} color={g.color} />
            ))}
          </div>
        )}
      </div>

      <div className="absolute left-2 top-2">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-white/10 hover:text-gray-300"
        >
          <MoreVertical size={16} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-0 top-8 z-20 w-36 rounded-xl border border-game-border bg-game-dark p-1 shadow-podium">
              <button
                onClick={() => { onEdit(); setMenuOpen(false) }}
                className="w-full rounded-lg px-3 py-2 text-right text-sm text-gray-300 hover:bg-white/5"
              >
                עריכה
              </button>
              <button
                onClick={() => { onManageGroups(); setMenuOpen(false) }}
                className="w-full rounded-lg px-3 py-2 text-right text-sm text-gray-300 hover:bg-white/5"
              >
                קבוצות
              </button>
              <button
                onClick={() => { onToggleActive(); setMenuOpen(false) }}
                className={cn(
                  'w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-white/5',
                  reward.is_active ? 'text-amber-400' : 'text-emerald-400',
                )}
              >
                {reward.is_active ? 'השבתה' : 'הפעלה'}
              </button>
            </div>
          </>
        )}
      </div>

      {!reward.is_active && (
        <div className="absolute right-2 top-2">
          <span className="rounded-full bg-gray-600/50 px-2 py-0.5 text-[10px] font-medium text-gray-400">
            לא פעיל
          </span>
        </div>
      )}
    </div>
  )
}
