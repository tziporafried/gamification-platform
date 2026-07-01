import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface ProgressBarProps {
  value: number
  max?: number
  size?: 'xs' | 'sm' | 'md'
  fillClassName?: string
  trackClassName?: string
  animated?: boolean
  className?: string
}

const SIZES = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5' }

export function ProgressBar({
  value,
  max = 100,
  size = 'sm',
  fillClassName,
  trackClassName,
  animated = true,
  className,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0

  return (
    <div className={cn('w-full overflow-hidden rounded-full', SIZES[size], trackClassName ?? theme.progressTrack, className)}>
      <div
        className={cn('h-full rounded-full', animated && 'transition-all duration-500', fillClassName ?? theme.progressFill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
