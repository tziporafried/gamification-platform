import { formatNumber } from './KpiCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { BarChart3 } from 'lucide-react'

export interface BarItem {
  label: string
  value: number
  secondary?: number
  secondaryLabel?: string
}

interface HorizontalBarsProps {
  items: BarItem[]
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  unavailable?: boolean
  unavailableDescription?: string
  valueLabel?: string
}

export function HorizontalBars({
  items,
  loading,
  emptyTitle = 'אין נתונים לטווח שנבחר',
  emptyDescription = 'נסו טווח תאריכים אחר.',
  unavailable,
  unavailableDescription = 'המימד המותאם עדיין לא זמין ב-GA4. שאר הדשבורד ממשיך לעבוד.',
  valueLabel = 'משתמשים',
}: HorizontalBarsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-elevated" />
        ))}
      </div>
    )
  }

  if (unavailable) {
    return (
      <EmptyState
        compact
        icon={<BarChart3 size={22} />}
        title="מימד עדיין לא זמין"
        description={unavailableDescription}
      />
    )
  }

  if (!items.length) {
    return (
      <EmptyState compact icon={<BarChart3 size={22} />} title={emptyTitle} description={emptyDescription} />
    )
  }

  const max = Math.max(...items.map((i) => i.value), 1)

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = Math.round((item.value / max) * 100)
        return (
          <li key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium text-foreground" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-muted">
                <span className="font-semibold text-foreground">{formatNumber(item.value)}</span>
                <span className="text-[11px]"> {valueLabel}</span>
                {item.secondary !== undefined && (
                  <span className="ms-2 text-[11px]">
                    · {formatNumber(item.secondary)} {item.secondaryLabel ?? 'פתיחות'}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full rounded-full bg-secondary transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
