import { cn } from '@/lib/utils'
import { ENTITY_LABELS, formatFreePlanLimitHelper, type LimitableEntity } from '@/lib/plans'
import type { PlanLimitInfo } from '@/hooks/usePlanLimits'
import { ProgressBar } from './ProgressBar'
import { theme } from '@/lib/theme'

interface UsageBarProps {
  info: PlanLimitInfo
  entity: LimitableEntity
  className?: string
  showCount?: boolean
  helperText?: string
}

export function UsageBar({ info, entity, className, showCount = true, helperText }: UsageBarProps) {
  if (info.limit === null) {
    return (
      <div className={cn('flex items-center gap-2 text-xs', theme.textSubtle, className)}>
        <span>{ENTITY_LABELS[entity]}: ללא הגבלה</span>
      </div>
    )
  }

  const limitHelperText = helperText ?? formatFreePlanLimitHelper(entity, info.limit)

  if (!showCount) {
    return (
      <div className={cn('space-y-1', className)}>
        <ProgressBar value={info.current} max={info.limit} />
        <p className={cn('text-center text-xs', theme.textSubtle)}>{limitHelperText}</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className={theme.textMuted}>{ENTITY_LABELS[entity]}</span>
        <span className={cn('font-medium', theme.textMuted)}>
          {info.current} מתוך {info.limit}
        </span>
      </div>
      <ProgressBar value={info.current} max={info.limit} />
    </div>
  )
}
