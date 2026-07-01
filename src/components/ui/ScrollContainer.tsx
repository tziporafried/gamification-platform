import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ScrollContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Pin scrollbar gutter to prevent layout shift */
  stableGutter?: boolean
}

export const ScrollContainer = forwardRef<HTMLDivElement, ScrollContainerProps>(
  ({ className, stableGutter = true, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('overflow-y-auto min-h-0 px-1', className)}
      style={stableGutter ? { scrollbarGutter: 'stable', ...style } : style}
      {...props}
    />
  ),
)

ScrollContainer.displayName = 'ScrollContainer'
