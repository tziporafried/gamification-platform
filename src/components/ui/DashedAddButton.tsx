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
        'flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-sm transition-colors disabled:opacity-50',
        theme.border,
        theme.textSubtle,
        'hover:border-brand-500/50 hover:text-brand-400',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
