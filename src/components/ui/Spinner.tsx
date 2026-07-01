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
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-t-transparent',
        SIZE_CLASSES[size],
        theme.spinner,
        className,
      )}
    />
  )
}
