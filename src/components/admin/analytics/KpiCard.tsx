import { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: number | string | null
  hint?: string
  loading?: boolean
  accent?: 'primary' | 'secondary' | 'tertiary' | 'muted'
  className?: string
  icon?: ReactNode
}

const ACCENT: Record<NonNullable<KpiCardProps['accent']>, string> = {
  primary: 'border-t-primary',
  secondary: 'border-t-secondary',
  tertiary: 'border-t-tertiary',
  muted: 'border-t-border',
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('he-IL').format(n)
}

export function formatRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${rate}%`
}

export function KpiCard({
  label,
  value,
  hint,
  loading,
  accent = 'primary',
  className,
  icon,
}: KpiCardProps) {
  return (
    <Card className={cn('border-t-2 p-4', ACCENT[accent], className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted leading-snug">{label}</p>
        {icon && <div className="shrink-0 text-secondary/80">{icon}</div>}
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-16 animate-pulse rounded-md bg-surface-elevated" />
      ) : (
        <p className="mt-2 text-2xl font-bold tabular-nums text-foreground tracking-tight">
          {typeof value === 'number' ? formatNumber(value) : value ?? '—'}
        </p>
      )}
      {hint && !loading && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </Card>
  )
}
