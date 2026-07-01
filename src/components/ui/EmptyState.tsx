import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
  variant?: 'dashed' | 'solid'
  compact?: boolean
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'dashed',
  compact = false,
  className,
}: EmptyStateProps) {
  const shell =
    variant === 'dashed'
      ? cn(
          'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-elevated text-center',
          compact ? 'px-4 py-4' : 'px-5 py-7',
        )
      : cn(
          theme.surfaceMuted,
          'flex flex-col items-center justify-center text-center',
          compact ? 'px-4 py-4' : 'px-5 py-8',
        )

  return (
    <div className={cn(shell, className)}>
      {icon && (
        <div
          className={cn(
            'flex items-center justify-center text-secondary transition-transform duration-200',
            compact ? 'mb-2 scale-100' : 'mb-3 scale-110',
          )}
        >
          {icon}
        </div>
      )}
      <h3 className={cn('text-sm font-semibold', variant === 'dashed' ? theme.label : theme.textMuted)}>
        {title}
      </h3>
      <p className={cn('mt-1.5 max-w-sm text-sm leading-relaxed', theme.textSubtle)}>{description}</p>
      {action && <div className={cn(compact ? 'mt-3' : 'mt-5')}>{action}</div>}
    </div>
  )
}
