import { cn } from '@/lib/utils'
import { ENTITY_LABELS, formatFreePlanLimitHelper, type LimitableEntity } from '@/lib/plans'
import type { PlanLimitInfo } from '@/hooks/usePlanLimits'
import { ProgressBar } from './ProgressBar'
import { theme } from '@/lib/theme'

interface UsageBarProps {
  info: PlanLimitInfo
  entity: LimitableEntity
  className?: string
  helperText?: string
}

export function UsageBar({ info, entity, className, helperText }: UsageBarProps) {
  if (info.limit === null) {
    return (
      <div className={cn('flex items-center gap-2 text-xs', theme.textSubtle, className)}>
        <span>{ENTITY_LABELS[entity]}: ללא הגבלה</span>
      </div>
    )
  }

  const limitHelperText = helperText ?? formatFreePlanLimitHelper(entity, info.limit)

  return (
    <div className={cn('group relative space-y-1', className)} tabIndex={0}>
      <div className="flex items-center justify-between text-xs">
        <span className={theme.textMuted}>{ENTITY_LABELS[entity]}</span>
        <span className={cn('font-medium', theme.textMuted)}>
          {info.current} מתוך {info.limit}
        </span>
      </div>
      <ProgressBar value={info.current} max={info.limit} />
      <p
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-[16rem] -translate-x-1/2',
          'rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-center text-xs text-muted shadow-card',
          'opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 group-focus-visible:opacity-100',
        )}
      >
        {limitHelperText}
      </p>
    </div>
  )
}
