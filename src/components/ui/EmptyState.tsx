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
      ? cn(theme.surfaceEmpty, compact && 'py-5 px-4')
      : cn(theme.surfaceMuted, 'flex flex-col items-center justify-center px-6 py-12 text-center', compact && 'py-5 px-4')

  return (
    <div className={cn(shell, className)}>
      {icon && <div className={cn('text-muted', compact ? 'mb-2' : 'mb-4')}>{icon}</div>}
      <h3 className={cn('text-sm font-semibold', variant === 'dashed' ? theme.label : theme.textMuted)}>
        {title}
      </h3>
      <p className={cn('mt-1 max-w-sm text-sm', theme.textSubtle)}>{description}</p>
      {action && <div className={cn(compact ? 'mt-3' : 'mt-4')}>{action}</div>}
    </div>
  )
}
