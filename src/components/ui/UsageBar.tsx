import { cn } from '@/lib/utils'
import { ENTITY_LABELS, type LimitableEntity } from '@/lib/plans'
import type { PlanLimitInfo } from '@/hooks/usePlanLimits'

interface UsageBarProps {
  info: PlanLimitInfo
  entity: LimitableEntity
  className?: string
}

export function UsageBar({ info, entity, className }: UsageBarProps) {
  if (info.limit === null) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-gray-500', className)}>
        <span>{ENTITY_LABELS[entity]}: ללא הגבלה</span>
      </div>
    )
  }

  const pct = Math.min((info.current / info.limit) * 100, 100)

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">{ENTITY_LABELS[entity]}</span>
        <span className="font-medium text-gray-400">
          {info.current} מתוך {info.limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-game-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 bg-brand-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
