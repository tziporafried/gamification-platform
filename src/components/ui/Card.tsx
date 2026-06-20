import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive'
}

const variantStyles = {
  default: 'rounded-xl border border-gray-200 bg-white shadow-card',
  elevated: 'rounded-xl border border-gray-200 bg-white shadow-podium',
  interactive: 'rounded-xl border border-gray-200 bg-white shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5',
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(variantStyles[variant], className)}
      {...props}
    />
  ),
)

Card.displayName = 'Card'

export { Card }
