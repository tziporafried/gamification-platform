import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import { ProgressBar } from './ProgressBar'

interface XPBarProps {
  current: number
  target: number
  label?: string
  className?: string
}

export function XPBar({ current, target, label, className }: XPBarProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className={cn('font-medium', theme.textMuted)}>{label}</span>
          <span className={cn('tabular-nums', theme.textSubtle)}>
            {current.toLocaleString()} / {target.toLocaleString()}
          </span>
        </div>
      )}
      <div className="relative overflow-hidden rounded-full bg-border/50">
        <ProgressBar
          value={current}
          max={target}
          size="md"
          trackClassName="bg-transparent"
          fillClassName="bg-success"
        />
      </div>
    </div>
  )
}
