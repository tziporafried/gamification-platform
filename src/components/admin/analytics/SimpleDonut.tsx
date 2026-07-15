import { formatNumber, formatRate } from './KpiCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { PieChart } from 'lucide-react'

interface DonutSlice {
  label: string
  value: number
  color: string
}

interface SimpleDonutProps {
  slices: DonutSlice[]
  loading?: boolean
  unavailable?: boolean
  unavailableTitle?: string
  unavailableDescription?: string
  emptyTitle?: string
  emptyDescription?: string
  /** Label under the center value */
  centerLabel?: string
  /** Override center numeric display (e.g. "72.9%") */
  centerValue?: string | null
  /** Show percentage share next to legend values */
  showLegendPercent?: boolean
  size?: 'md' | 'lg'
}

export function SimpleDonut({
  slices,
  loading,
  unavailable,
  unavailableTitle = 'מימד עדיין לא זמין',
  unavailableDescription = 'הפירוט יתרענן כשהמימד המותאם יהיה זמין ב-GA4.',
  emptyTitle = 'אין נתונים',
  emptyDescription = 'אין נתונים בטווח שנבחר.',
  centerLabel = 'סה״כ',
  centerValue,
  showLegendPercent = false,
  size = 'md',
}: SimpleDonutProps) {
  const dim = size === 'lg' ? 180 : 160
  const r = size === 'lg' ? 62 : 54
  const stroke = size === 'lg' ? 20 : 16

  if (loading) {
    return (
      <div
        className="mx-auto animate-pulse rounded-full bg-surface-elevated"
        style={{ width: dim, height: dim }}
      />
    )
  }

  if (unavailable) {
    return (
      <EmptyState
        compact
        icon={<PieChart size={22} />}
        title={unavailableTitle}
        description={unavailableDescription}
      />
    )
  }

  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total <= 0) {
    return (
      <EmptyState compact icon={<PieChart size={22} />} title={emptyTitle} description={emptyDescription} />
    )
  }

  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: dim, height: dim }}>
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
          {slices.map((slice) => {
            if (slice.value <= 0) return null
            const len = (slice.value / total) * c
            const el = (
              <circle
                key={slice.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={slice.color}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            )
            offset += len
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <span
            className={`font-bold tabular-nums text-foreground ${size === 'lg' ? 'text-2xl' : 'text-xl'}`}
          >
            {centerValue ?? formatNumber(total)}
          </span>
          <span className="mt-0.5 text-[11px] leading-tight text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full max-w-xs space-y-2 text-sm">
        {slices
          .filter((s) => s.value > 0)
          .map((slice) => {
            const pct = Math.round((slice.value / total) * 1000) / 10
            return (
              <li key={slice.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                <span className="min-w-0 flex-1 truncate text-foreground">{slice.label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {formatNumber(slice.value)}
                  {showLegendPercent && (
                    <span className="ms-1.5 text-[11px]">({formatRate(pct)})</span>
                  )}
                </span>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
