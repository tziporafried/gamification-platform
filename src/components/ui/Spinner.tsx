import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'h-6 w-6 border-4',
  md: 'h-8 w-8 border-4',
  lg: 'h-9 w-9 border-4',
}

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
  /** Announced while loading. Pass null when a parent already labels the region. */
  label?: string | null
}

export function Spinner({ size = 'md', className, label = 'טוען…' }: SpinnerProps) {
  return (
    <div
      // The spinner was purely visual - screen reader users got silence during
      // every load. role="status" announces the label politely (WCAG 4.1.3).
      role={label ? 'status' : undefined}
      className={cn(
        'animate-spin rounded-full border-t-transparent',
        // Honour prefers-reduced-motion: keep the ring, drop the rotation.
        'motion-reduce:animate-none',
        SIZE_CLASSES[size],
        theme.spinner,
        className,
      )}
    >
      {label && <span className="sr-only">{label}</span>}
    </div>
  )
}
