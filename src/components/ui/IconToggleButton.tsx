import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface IconToggleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  activeColor?: string
  children: ReactNode
}

export function IconToggleButton({ active = false, activeColor, className, children, style, ...props }: IconToggleButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-lg p-2 transition-all',
        active ? 'bg-surface-elevated text-secondary' : cn('text-muted hover:bg-surface-elevated hover:text-foreground'),
        className,
      )}
      style={active && activeColor ? { color: activeColor, ...style } : style}
      {...props}
    >
      {children}
    </button>
  )
}
