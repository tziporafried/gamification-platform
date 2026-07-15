import { EmptyState } from '@/components/ui/EmptyState'
import { BarChart3 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNumber } from './KpiCard'

interface RankedBarChartProps {
  items: { label: string; value: number }[]
  loading?: boolean
  unavailable?: boolean
  unavailableDescription?: string
  emptyTitle?: string
  emptyDescription?: string
  valueLabel?: string
  color?: string
}

function truncateOneLine(label: string, max = 28): string {
  const compact = label.replace(/\s+/g, ' ').trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, max - 1)}…`
}

export function RankedBarChart({
  items,
  loading,
  unavailable,
  unavailableDescription = 'המימד המותאם עדיין לא זמין ב-GA4.',
  emptyTitle = 'אין נתונים לטווח שנבחר',
  emptyDescription = 'נסו טווח תאריכים אחר.',
  valueLabel = 'משתמשים ייחודיים',
  color = 'var(--color-primary)',
}: RankedBarChartProps) {
  if (loading) {
    return <div className="h-56 animate-pulse rounded-xl bg-surface-elevated" />
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

  const populated = items.filter((i) => i.value > 0)
  if (!populated.length) {
    return (
      <EmptyState compact icon={<BarChart3 size={22} />} title={emptyTitle} description={emptyDescription} />
    )
  }

  const data = populated.map((item) => ({
    name: truncateOneLine(item.label),
    full: item.label.replace(/\s+/g, ' ').trim(),
    value: item.value,
  }))
  const height = Math.max(180, data.length * 34 + 32)

  return (
    <div style={{ height }} className="w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            interval={0}
            tick={{
              fill: 'var(--color-foreground)',
              fontSize: 11,
              style: { whiteSpace: 'nowrap' as const },
            }}
            axisLine={false}
            tickLine={false}
            reversed
          />
          <RechartsTooltip
            cursor={{ fill: 'var(--color-surface-elevated)' }}
            contentStyle={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              direction: 'rtl',
              textAlign: 'right',
            }}
            formatter={(value: number) => [formatNumber(value), valueLabel]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { full?: string } | undefined
              return row?.full ?? ''
            }}
          />
          <Bar
            dataKey="value"
            radius={[0, 6, 6, 0]}
            barSize={16}
            label={{
              position: 'right',
              fill: 'var(--color-muted)',
              fontSize: 11,
              formatter: (v: number) => formatNumber(v),
            }}
          >
            {data.map((entry) => (
              <Cell key={entry.full} fill={color} fillOpacity={0.88} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
