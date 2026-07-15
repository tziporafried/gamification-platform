import { Info } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatNumber, formatRate } from './KpiCard'

export interface FunnelStep {
  label: string
  value: number
}

interface FunnelChartProps {
  steps: FunnelStep[]
  loading?: boolean
  overallRate?: number | null
  overallLabel?: string
  /** Subtle info tooltip content (kept out of the main visual body) */
  infoTooltip?: string
  title?: string
  className?: string
  compact?: boolean
}

function calcStepRate(from: number, to: number): number | null {
  if (from <= 0) return null
  return Math.round((to / from) * 1000) / 10
}

export function FunnelChart({
  steps,
  loading,
  overallRate,
  overallLabel,
  infoTooltip,
  title,
  className,
  compact,
}: FunnelChartProps) {
  const max = Math.max(...steps.map((s) => s.value), 1)

  if (loading) {
    return (
      <div className={className}>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="mx-auto h-11 animate-pulse rounded-lg bg-surface-elevated"
              style={{ width: `${100 - i * 12}%` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {(title || infoTooltip) && (
        <div className="mb-4 flex items-center gap-2">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {infoTooltip && (
            <Tooltip content={infoTooltip} rich side="bottom">
              <button
                type="button"
                className="inline-flex rounded-full p-0.5 text-muted transition-colors hover:text-foreground"
                aria-label="מידע על ההשוואה"
              >
                <Info size={14} />
              </button>
            </Tooltip>
          )}
        </div>
      )}

      <div className={`flex flex-col items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {steps.map((step, i) => {
          const widthPct = Math.max(18, Math.round((step.value / max) * 100))
          const prev = i > 0 ? steps[i - 1].value : null
          const fromPrev = prev !== null ? calcStepRate(prev, step.value) : null

          return (
            <div key={step.label} className="w-full">
              {i > 0 && fromPrev !== null && (
                <p className="mb-1 text-center text-[10px] font-medium tabular-nums text-muted">
                  {formatRate(fromPrev)} מהשלב הקודם
                </p>
              )}
              <div className="mx-auto" style={{ width: `${widthPct}%`, minWidth: '9rem' }}>
                <div
                  className={`flex items-center justify-between gap-3 rounded-lg bg-secondary/85 px-3 text-secondary-foreground shadow-sm ${
                    compact ? 'py-2' : 'py-2.5'
                  }`}
                  style={{
                    clipPath:
                      i === 0
                        ? undefined
                        : 'polygon(4% 0, 96% 0, 100% 100%, 0 100%)',
                    borderRadius: i === 0 ? undefined : '0.5rem',
                  }}
                >
                  <span className={`truncate font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
                    {step.label}
                  </span>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${compact ? 'text-sm' : 'text-base'}`}
                  >
                    {formatNumber(step.value)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {overallLabel && (
        <div className="mt-5 rounded-xl border border-border bg-surface-elevated/60 px-4 py-3 text-center">
          <p className="text-xs text-muted">{overallLabel}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {formatRate(overallRate ?? null)}
          </p>
        </div>
      )}
    </div>
  )
}
