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
  /**
   * Heading level for the title. Defaults to h3, which suits the usual nested
   * use. Pass "h1" when the empty state *is* the page — otherwise the page has
   * no h1 and the outline starts at h3 (WCAG 1.3.1).
   */
  as?: 'h1' | 'h2' | 'h3' | 'h4'
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'dashed',
  compact = false,
  className,
  as: Heading = 'h3',
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
          aria-hidden="true"
          className={cn(
            'flex items-center justify-center text-secondary-text transition-transform duration-200',
            compact ? 'mb-2 scale-100' : 'mb-3 scale-110',
          )}
        >
          {icon}
        </div>
      )}
      <Heading className={cn('text-sm font-semibold', variant === 'dashed' ? theme.label : theme.textMuted)}>
        {title}
      </Heading>
      <p className={cn('mt-1.5 max-w-sm text-sm leading-relaxed', theme.textSubtle)}>{description}</p>
      {action && <div className={cn(compact ? 'mt-3' : 'mt-5')}>{action}</div>}
    </div>
  )
}
