import { cn } from '@/lib/utils'

interface ColorDotProps {
  color: string
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

const SIZES = {
  xs: 'h-2 w-2',
  sm: 'h-2.5 w-2.5',
  md: 'h-3.5 w-3.5',
}

export function ColorDot({ color, size = 'sm', className }: ColorDotProps) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', SIZES[size], className)}
      style={{ backgroundColor: color }}
    />
  )
}
