import { formatNumber } from './KpiCard'
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
  centerLabel?: string
}

export function SimpleDonut({
  slices,
  loading,
  unavailable,
  centerLabel = 'סה״כ',
}: SimpleDonutProps) {
  if (loading) {
    return <div className="mx-auto h-40 w-40 animate-pulse rounded-full bg-surface-elevated" />
  }

  if (unavailable) {
    return (
      <EmptyState
        compact
        icon={<PieChart size={22} />}
        title="מימד עדיין לא זמין"
        description="פירוט לפי שיטת יצירה יתרענן כש-customEvent:creation_method יהיה זמין ב-GA4."
      />
    )
  }

  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total <= 0) {
    return (
      <EmptyState
        compact
        icon={<PieChart size={22} />}
        title="אין נתוני יצירה"
        description="עדיין לא נוצרו אירועים בטווח שנבחר."
      />
    )
  }

  const r = 54
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
      <div className="relative h-40 w-40">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-border)" strokeWidth="16" />
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
                strokeWidth="16"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            )
            offset += len
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted">{centerLabel}</span>
          <span className="text-xl font-bold tabular-nums text-foreground">{formatNumber(total)}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: slice.color }} />
            <span className="text-foreground">{slice.label}</span>
            <span className="tabular-nums text-muted">{formatNumber(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
