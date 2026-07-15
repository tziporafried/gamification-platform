import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '@/components/ui/EmptyState'
import { TrendingUp } from 'lucide-react'
import { formatNumber } from './KpiCard'
import type { AnalyticsTimeSeriesDay } from './types'

type SeriesKey = 'visitors' | 'videoView' | 'viewPlans' | 'generateLead'

const SERIES: { key: SeriesKey; label: string }[] = [
  { key: 'visitors', label: 'מבקרים' },
  { key: 'videoView', label: 'סרטון' },
  { key: 'viewPlans', label: 'מחירים' },
  { key: 'generateLead', label: 'לידים' },
]

const SERIES_LABELS: Record<SeriesKey, string> = {
  visitors: 'מבקרים ייחודיים',
  videoView: 'צפו בסרטון',
  viewPlans: 'צפו במחירים',
  generateLead: 'לידים',
}

interface TrendLineChartProps {
  days: AnalyticsTimeSeriesDay[]
  loading?: boolean
  unavailable?: boolean
}

function formatShortDate(ymd: string): string {
  const [, m, d] = ymd.split('-')
  if (!m || !d) return ymd
  return `${Number(d)}.${Number(m)}`
}

function formatFullDate(ymd: string): string {
  try {
    return new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${ymd}T12:00:00`))
  } catch {
    return ymd
  }
}

export function TrendLineChart({ days, loading, unavailable }: TrendLineChartProps) {
  const [series, setSeries] = useState<SeriesKey>('visitors')

  const chartData = useMemo(
    () =>
      days.map((d) => ({
        date: d.date,
        label: formatShortDate(d.date),
        value: d[series],
      })),
    [days, series],
  )

  const uniqueDayCount = days.length
  const hasMultipleDays = uniqueDayCount > 1

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-surface-elevated" />
  }

  if (unavailable) {
    return (
      <EmptyState
        compact
        icon={<TrendingUp size={22} />}
        title="מגמה לא זמינה"
        description="לא ניתן לטעון את נתוני המגמה היומית כרגע."
      />
    )
  }

  if (!hasMultipleDays) {
    return (
      <div className="space-y-4">
        <SeriesSelector series={series} onChange={setSeries} />
        <EmptyState
          compact
          icon={<TrendingUp size={22} />}
          title="אין מספיק ימים להצגת מגמה"
          description="בחרו טווח של יותר מיום אחד כדי לראות שינוי לאורך זמן."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SeriesSelector series={series} onChange={setSeries} />
      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
              allowDecimals={false}
            />
            <RechartsTooltip
              contentStyle={{
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                direction: 'rtl',
                textAlign: 'right',
              }}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as { date?: string } | undefined
                return row?.date ? formatFullDate(row.date) : ''
              }}
              formatter={(value: number) => [
                formatNumber(value),
                SERIES_LABELS[series],
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-secondary)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--color-secondary)', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SeriesSelector({
  series,
  onChange,
}: {
  series: SeriesKey
  onChange: (key: SeriesKey) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SERIES.map((s) => {
        const active = s.key === series
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-secondary text-secondary-foreground'
                : 'bg-surface-elevated text-muted hover:text-foreground'
            }`}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
