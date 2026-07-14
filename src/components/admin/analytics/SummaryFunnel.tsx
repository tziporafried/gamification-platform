import { formatNumber, formatRate } from './KpiCard'

export interface FunnelStep {
  label: string
  value: number
  /** Conversion from previous step */
  stepRate?: number | null
}

interface SummaryFunnelProps {
  steps: FunnelStep[]
  overallRate?: number | null
  overallLabel?: string
  loading?: boolean
  note?: string
}

export function SummaryFunnel({
  steps,
  overallRate,
  overallLabel = 'מהשלב הראשון לאחרון',
  loading,
  note,
}: SummaryFunnelProps) {
  const max = Math.max(...steps.map((s) => s.value), 1)

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-elevated" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {note && <p className="mb-3 text-xs text-muted leading-relaxed">{note}</p>}
      {steps.map((step, i) => {
        const widthPct = Math.max(12, Math.round((step.value / max) * 100))
        return (
          <div key={step.label}>
            {i > 0 && (
              <div className="flex items-center justify-center py-1.5">
                <div className="flex flex-col items-center gap-0.5 text-muted">
                  <span className="text-[10px] font-medium">
                    {step.stepRate === null || step.stepRate === undefined
                      ? '↓'
                      : `${formatRate(step.stepRate)} מהשלב הקודם`}
                  </span>
                </div>
              </div>
            )}
            <div className="relative overflow-hidden rounded-xl border border-border bg-surface px-4 py-3">
              <div
                className="pointer-events-none absolute inset-y-0 inset-inline-start-0 rounded-xl bg-primary/12 transition-[width] duration-500"
                style={{ width: `${widthPct}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-muted">שלב {i + 1}</p>
                  <p className="text-sm font-semibold text-foreground">{step.label}</p>
                </div>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {formatNumber(step.value)}
                </p>
              </div>
            </div>
          </div>
        )
      })}
      {overallRate !== undefined && (
        <p className="pt-2 text-center text-xs text-muted">
          {overallLabel}:{' '}
          <span className="font-semibold text-foreground">{formatRate(overallRate)}</span>
        </p>
      )}
    </div>
  )
}
