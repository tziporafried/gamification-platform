import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/utils'

interface AnimatedCounterProps {
  value: number
  duration?: number
  suffix?: string
  className?: string
}

export function AnimatedCounter({ value, duration = 1200, suffix, className }: AnimatedCounterProps) {
  const displayValue = useCountUp(value, duration)

  return (
    <span className={cn('tabular-nums', className)}>
      {displayValue.toLocaleString()}
      {suffix && <span className="ml-0.5">{suffix}</span>}
    </span>
  )
}
