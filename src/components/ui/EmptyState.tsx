import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
  variant?: 'dashed' | 'solid'
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'dashed',
  className,
}: EmptyStateProps) {
  const shell =
    variant === 'dashed'
      ? theme.surfaceEmpty
      : cn(theme.surfaceMuted, 'flex flex-col items-center justify-center px-6 py-12 text-center')

  return (
    <div className={cn(shell, className)}>
      {icon && <div className="mb-4 text-muted">{icon}</div>}
      <h3 className={cn('text-sm font-semibold', variant === 'dashed' ? theme.label : theme.textMuted)}>
        {title}
      </h3>
      <p className={cn('mt-1 max-w-sm text-sm', theme.textSubtle)}>{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
