import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { chipColors, type ChipColor } from '@/lib/theme'

interface ChipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ChipColor
  children: ReactNode
}

export const ChipButton = forwardRef<HTMLButtonElement, ChipButtonProps>(
  function ChipButton({ color = 'brand', className, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all',
          chipColors[color],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)
