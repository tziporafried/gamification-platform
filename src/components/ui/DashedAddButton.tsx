import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface DashedAddButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export function DashedAddButton({ className, children, ...props }: DashedAddButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm text-primary-text shadow-lift',
        'transition-all duration-[180ms] ease-out',
        theme.borderInteractiveDashed,
        'hover:bg-surface-elevated hover:shadow-card-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
