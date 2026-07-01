import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantStyles = {
      default: theme.surfaceCard,
      elevated: theme.surfaceCardElevated,
      interactive: cn(theme.surfaceCard, theme.surfaceInteractive),
    }

    return <div ref={ref} className={cn(variantStyles[variant], className)} {...props} />
  },
)

Card.displayName = 'Card'

export { Card }
