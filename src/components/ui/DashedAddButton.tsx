import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DashedAddButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export function DashedAddButton({ className, children, ...props }: DashedAddButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3.5 text-sm',
        'border-tertiary/40 text-primary shadow-lift',
        'transition-all duration-[180ms] ease-out',
        'hover:border-tertiary/70 hover:bg-surface-elevated hover:shadow-card-hover',
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
