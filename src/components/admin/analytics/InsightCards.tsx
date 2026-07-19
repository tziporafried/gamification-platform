import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { AnalyticsInsight, InsightSeverity } from './types'

const SEVERITY_STYLES: Record<
  InsightSeverity,
  { border: string; bg: string; icon: string; Icon: typeof AlertTriangle }
> = {
  critical: {
    border: 'border-danger/40',
    bg: 'bg-danger/5',
    icon: 'text-danger-text',
    Icon: AlertTriangle,
  },
  warning: {
    border: 'border-warning/40',
    bg: 'bg-warning/5',
    icon: 'text-warning-text',
    Icon: Info,
  },
  positive: {
    border: 'border-success/40',
    bg: 'bg-success/5',
    icon: 'text-success-text',
    Icon: CheckCircle2,
  },
}

interface InsightCardsProps {
  insights: AnalyticsInsight[]
  loading?: boolean
}

export function InsightCards({ insights, loading }: InsightCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-elevated" />
        ))}
      </div>
    )
  }

  if (!insights.length) {
    return (
      <Card className="border-border/80 p-4">
        <p className="text-sm text-muted">
          אין תובנות חריגות בטווח שנבחר — הנתונים נראים יציבים יחסית.
        </p>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {insights.map((insight) => {
        const style = SEVERITY_STYLES[insight.severity]
        const Icon = style.Icon
        return (
          <Card key={insight.id} className={cn('space-y-2 border p-4', style.border, style.bg)}>
            <div className="flex items-start gap-2">
              <Icon size={16} className={cn('mt-0.5 shrink-0', style.icon)} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{insight.title}</p>
                <p className="mt-1 text-sm leading-snug text-foreground">{insight.detail}</p>
                <p className="mt-2 text-[11px] tabular-nums text-muted">{insight.counts}</p>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
