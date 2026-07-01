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
        'flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-sm transition-colors disabled:opacity-50',
        'border-tertiary/40 text-primary',
        'hover:border-tertiary hover:bg-surface-elevated',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
