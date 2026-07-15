import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { EmptyState } from '@/components/ui/EmptyState'
import { BarChart3 } from 'lucide-react'
import { formatNumber } from './KpiCard'

interface FaqBarChartProps {
  items: { question: string; users: number }[]
  loading?: boolean
  unavailable?: boolean
}

function truncateLabel(text: string, max = 28): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

export function FaqBarChart({ items, loading, unavailable }: FaqBarChartProps) {
  if (loading) {
    return <div className="h-72 animate-pulse rounded-xl bg-surface-elevated" />
  }

  if (unavailable) {
    return (
      <EmptyState
        compact
        icon={<BarChart3 size={22} />}
        title="פירוט השאלות עדיין לא זמין"
        description="שאר הדשבורד ממשיך לעבוד כרגיל."
      />
    )
  }

  if (!items.length) {
    return (
      <EmptyState
        compact
        icon={<BarChart3 size={22} />}
        title="אין פתיחות FAQ"
        description="בטווח שנבחר אף משתמש לא פתח שאלות נפוצות."
      />
    )
  }

  const data = items.map((item, i) => ({
    name: truncateLabel(item.question),
    full: item.question,
    users: item.users,
    rank: i + 1,
  }))

  const height = Math.max(220, data.length * 36 + 40)

  return (
    <div style={{ height }} className="w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
        >
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fill: 'var(--color-foreground)', fontSize: 11, textAnchor: 'end' }}
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
              maxWidth: 280,
            }}
            formatter={(value: number) => [formatNumber(value), 'משתמשים ייחודיים']}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { full?: string } | undefined
              return row?.full ?? ''
            }}
          />
          <Bar dataKey="users" radius={[0, 6, 6, 0]} barSize={18} label={{
            position: 'right',
            fill: 'var(--color-muted)',
            fontSize: 11,
            formatter: (v: number) => formatNumber(v),
          }}>
            {data.map((entry) => (
              <Cell key={entry.full} fill="var(--color-secondary)" fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
