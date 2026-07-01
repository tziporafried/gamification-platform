import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface PanelCardProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'elevated' | 'interactive'
}

const PADDING = { sm: 'p-4', md: 'p-5', lg: 'p-6' }

export const PanelCard = forwardRef<HTMLDivElement, PanelCardProps>(
  ({ className, size = 'md', variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        theme.surfacePanel,
        PADDING[size],
        variant === 'interactive' && theme.surfaceInteractive,
        variant === 'elevated' && 'shadow-podium',
        className,
      )}
      {...props}
    />
  ),
)

PanelCard.displayName = 'PanelCard'
