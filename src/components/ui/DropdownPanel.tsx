import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface DropdownPanelProps {
  children: ReactNode
  className?: string
  width?: string
  align?: 'left' | 'right'
}

export function DropdownPanel({
  children,
  className,
  width = 'w-48',
  align = 'right',
}: DropdownPanelProps) {
  return (
    <div
      className={cn(
        'absolute z-50 top-full mt-1 rounded-xl border py-1 shadow-podium',
        'animate-[fade-in_150ms_ease-out,slide-down_150ms_ease-out]',
        theme.bgCard,
        theme.border,
        width,
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function DropdownHeader({ children }: { children: ReactNode }) {
  return <div className={cn('px-3 py-1.5 text-[10px]', theme.textSubtle)}>{children}</div>
}

export function DropdownDivider() {
  return <div className={cn('mx-2 my-1 border-t', theme.border)} />
}

interface DropdownItemProps {
  children: ReactNode
  active?: boolean
  activeClassName?: string
  onClick?: () => void
  className?: string
}

export function DropdownItem({
  children,
  active = false,
  activeClassName,
  onClick,
  className,
}: DropdownItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors',
        theme.hoverSurface,
        active ? (activeClassName ?? theme.text) : theme.textMuted,
        className,
      )}
    >
      {children}
    </button>
  )
}
