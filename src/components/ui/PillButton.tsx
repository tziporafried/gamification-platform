import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  size?: 'xs' | 'sm'
  children: ReactNode
}

const SIZES = { xs: 'px-2.5 py-1.5 text-[11px]', sm: 'px-3 py-1.5 text-xs' }

export function PillButton({ active = false, size = 'xs', className, children, ...props }: PillButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-lg border font-medium transition-all',
        SIZES[size],
        active
          ? cn(theme.accentBorder, theme.accentBg, theme.accentText)
          : cn(theme.border, theme.textSubtle, 'hover:border-brand-500/30 hover:text-gray-300'),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
