import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps {
  label: string
  color: string
  variant?: 'subtle' | 'solid' | 'outline'
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Badge({ label, color, variant = 'subtle', size = 'sm', icon }: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'

  const variantStyles: Record<string, { bg: string; textColor: string; border?: string }> = {
    subtle: {
      bg: `color-mix(in srgb, ${color} 10%, transparent)`,
      textColor: color,
    },
    solid: {
      bg: color,
      textColor: 'var(--color-foreground)',
    },
    outline: {
      bg: 'transparent',
      textColor: color,
      border: color,
    },
  }

  const style = variantStyles[variant]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        sizeClasses,
      )}
      style={{
        backgroundColor: style.bg,
        color: style.textColor,
        ...(style.border ? { border: `1px solid ${style.border}` } : {}),
      }}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {label}
    </span>
  )
}
