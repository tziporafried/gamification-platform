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
        active ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300',
        className,
      )}
      style={active && activeColor ? { color: activeColor, ...style } : style}
      {...props}
    >
      {children}
    </button>
  )
}
