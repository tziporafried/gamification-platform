import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
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

export type TrendSeriesKey =
  | 'visitors'
  | 'newUsers'
  | 'videoView'
  | 'videoComplete'
  | 'viewPlans'
  | 'selectPlan'
  | 'contactFormOpen'
  | 'generateLead'
  | 'ctaClick'
  | 'faqOpen'
  | 'loginView'
  | 'signUp'
  | 'eventCreated'

interface SeriesDef {
  key: TrendSeriesKey
  label: string
  color: string
}

interface SeriesGroup {
  id: string
  label: string
  series: SeriesDef[]
}

const SERIES_GROUPS: SeriesGroup[] = [
  {
    id: 'traffic',
    label: 'תנועה',
    series: [
      { key: 'visitors', label: 'מבקרים', color: '#2dd4bf' },
      { key: 'newUsers', label: 'משתמשים חדשים', color: '#f59e0b' },
    ],
  },
  {
    id: 'engagement',
    label: 'מעורבות',
    series: [
      { key: 'videoView', label: 'סרטון', color: '#a78bfa' },
      { key: 'videoComplete', label: 'סיימו סרטון', color: '#818cf8' },
      { key: 'faqOpen', label: 'FAQ', color: '#fb7185' },
      { key: 'ctaClick', label: 'CTA', color: '#38bdf8' },
    ],
  },
  {
    id: 'conversion',
    label: 'המרה',
    series: [
      { key: 'viewPlans', label: 'מחירים', color: '#f97316' },
      { key: 'selectPlan', label: 'בחירת מסלול', color: '#fb923c' },
      { key: 'contactFormOpen', label: 'פתיחת טופס', color: '#34d399' },
      { key: 'generateLead', label: 'לידים', color: '#22c55e' },
    ],
  },
  {
    id: 'product',
    label: 'מוצר',
    series: [
      { key: 'loginView', label: 'מסך התחברות', color: '#94a3b8' },
      { key: 'signUp', label: 'הרשמות', color: '#64748b' },
      { key: 'eventCreated', label: 'יצירת אירוע', color: '#e879f9' },
    ],
  },
]

const ALL_SERIES = SERIES_GROUPS.flatMap((g) => g.series)

const SERIES_BY_KEY = Object.fromEntries(ALL_SERIES.map((s) => [s.key, s])) as Record<
  TrendSeriesKey,
  SeriesDef
>

const SERIES_LABELS_DAY: Record<TrendSeriesKey, string> = {
  visitors: 'מבקרים בדף הבית (ליום)',
  newUsers: 'משתמשים חדשים (ליום)',
  videoView: 'צפו בסרטון',
  videoComplete: 'סיימו סרטון',
  viewPlans: 'צפו במחירים',
  selectPlan: 'בחרו מסלול',
  contactFormOpen: 'פתחו טופס',
  generateLead: 'לידים',
  ctaClick: 'לחיצות CTA',
  faqOpen: 'פתיחות FAQ',
  loginView: 'מסך התחברות',
  signUp: 'הרשמות',
  eventCreated: 'יצירת אירוע',
}

const SERIES_LABELS_HOUR: Record<TrendSeriesKey, string> = {
  ...SERIES_LABELS_DAY,
  visitors: 'מבקרים בדף הבית (לשעה)',
  newUsers: 'משתמשים חדשים (לשעה)',
}

const DEFAULT_SELECTED: TrendSeriesKey[] = ['visitors', 'generateLead', 'viewPlans']

interface TrendLineChartProps {
  days: AnalyticsTimeSeriesDay[]
  loading?: boolean
  unavailable?: boolean
  /** Chart height in px — hero dashboard uses a larger value */
  height?: number
  granularity?: 'day' | 'hour'
}

function isHourBucket(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(value)
}

function formatShortDate(ymd: string): string {
  if (isHourBucket(ymd)) {
    return `${ymd.slice(11, 13)}:00`
  }
  const [, m, d] = ymd.split('-')
  if (!m || !d) return ymd
  return `${Number(d)}.${Number(m)}`
}

function formatFullDate(ymd: string): string {
  try {
    if (isHourBucket(ymd)) {
      const hour = ymd.slice(11, 13)
      const dayLabel = new Intl.DateTimeFormat('he-IL', {
        day: 'numeric',
        month: 'short',
      }).format(new Date(`${ymd.slice(0, 10)}T12:00:00`))
      return `${dayLabel} · ${hour}:00`
    }
    return new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${ymd}T12:00:00`))
  } catch {
    return ymd
  }
}

function dayValue(d: AnalyticsTimeSeriesDay, key: TrendSeriesKey): number {
  return Number(d[key] ?? 0)
}

export function TrendLineChart({
  days,
  loading,
  unavailable,
  height = 420,
  granularity = 'day',
}: TrendLineChartProps) {
  const [selected, setSelected] = useState<TrendSeriesKey[]>(DEFAULT_SELECTED)
  const hourly = granularity === 'hour' || days.some((d) => isHourBucket(d.date))
  const seriesLabels = hourly ? SERIES_LABELS_HOUR : SERIES_LABELS_DAY

  const chartData = useMemo(
    () =>
      days.map((d) => {
        const row: Record<string, string | number> = {
          date: d.date,
          label: formatShortDate(d.date),
        }
        for (const s of ALL_SERIES) {
          row[s.key] = dayValue(d, s.key)
        }
        return row
      }),
    [days],
  )

  const hasEnoughPoints = days.length > 1

  function toggleSeries(key: TrendSeriesKey) {
    setSelected((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev
        return prev.filter((k) => k !== key)
      }
      return [...prev, key]
    })
  }

  function selectGroup(group: SeriesGroup) {
    setSelected((prev) => {
      const keys = group.series.map((s) => s.key)
      const allOn = keys.every((k) => prev.includes(k))
      if (allOn) {
        const next = prev.filter((k) => !keys.includes(k))
        return next.length > 0 ? next : [keys[0]]
      }
      return [...new Set([...prev, ...keys])]
    })
  }

  if (loading) {
    return <div className="animate-pulse rounded-xl bg-surface-elevated" style={{ height }} />
  }

  if (unavailable) {
    return (
      <EmptyState
        compact
        icon={<TrendingUp size={22} />}
        title="מגמה לא זמינה"
        description="לא ניתן לטעון את נתוני המגמה כרגע."
      />
    )
  }

  if (!hasEnoughPoints) {
    return (
      <div className="space-y-2">
        <SeriesSelector
          selected={selected}
          onToggle={toggleSeries}
          onSelectGroup={selectGroup}
        />
        <EmptyState
          compact
          icon={<TrendingUp size={22} />}
          title="אין מספיק נקודות להצגת מגמה"
          description="בחרו טווח של יותר מיום אחד, או יום בודד לפיצול שעתי."
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <SeriesSelector
        selected={selected}
        onToggle={toggleSeries}
        onSelectGroup={selectGroup}
      />
      {hourly && (
        <p className="text-[11px] text-muted">פיצול לפי שעה · 24 שעות ביום שנבחר</p>
      )}
      <div className="w-full" style={{ height }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              minTickGap={hourly ? 8 : 24}
              interval={hourly ? 1 : 'preserveStartEnd'}
            />
            <YAxis
              tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
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
              formatter={(value: number, name: string) => [
                formatNumber(value),
                seriesLabels[name as TrendSeriesKey] ?? name,
              ]}
            />
            <Legend
              verticalAlign="top"
              align="center"
              wrapperStyle={{ direction: 'rtl', fontSize: 12, paddingBottom: 10 }}
              formatter={(value: string) => seriesLabels[value as TrendSeriesKey] ?? value}
            />
            {selected.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={SERIES_BY_KEY[key].color}
                strokeWidth={2.75}
                dot={{ r: hourly ? 2.5 : 3.5, fill: SERIES_BY_KEY[key].color, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SeriesSelector({
  selected,
  onToggle,
  onSelectGroup,
}: {
  selected: TrendSeriesKey[]
  onToggle: (key: TrendSeriesKey) => void
  onSelectGroup: (group: SeriesGroup) => void
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
      title="בחרו כמה מדדים · לחיצה על שם קבוצה מדליקה/מכבה את כולה"
    >
      {SERIES_GROUPS.map((group, gi) => {
        const allOn = group.series.every((s) => selected.includes(s.key))
        return (
          <div key={group.id} className="flex flex-wrap items-center gap-1">
            {gi > 0 && (
              <span className="mx-0.5 hidden h-3 w-px bg-border sm:inline-block" aria-hidden />
            )}
            <button
              type="button"
              onClick={() => onSelectGroup(group)}
              className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                allOn ? 'text-secondary' : 'text-muted hover:text-foreground'
              }`}
            >
              {group.label}
            </button>
            {group.series.map((s) => {
              const active = selected.includes(s.key)
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onToggle(s.key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight transition-colors ${
                    active
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-surface-elevated text-muted hover:text-foreground'
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.label}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
