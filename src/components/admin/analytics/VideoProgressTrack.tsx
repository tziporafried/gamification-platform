import { formatNumber, formatRate } from './KpiCard'
import { cn } from '@/lib/utils'

export interface ProgressMilestone {
  label: string
  users: number
}

interface VideoProgressTrackProps {
  milestones: ProgressMilestone[]
  loading?: boolean
  insight?: { kind: 'drop' | 'positive'; text: string } | null
  unavailable?: boolean
  unavailableNote?: string
}

function stepRate(from: number, to: number): number | null {
  if (from <= 0) return null
  return Math.round((to / from) * 1000) / 10
}

export function VideoProgressTrack({
  milestones,
  loading,
  insight,
  unavailable,
  unavailableNote,
}: VideoProgressTrackProps) {
  if (loading) {
    return <div className="h-28 animate-pulse rounded-xl bg-surface-elevated" />
  }

  if (!milestones.length) {
    return <p className="text-sm text-muted">אין נתוני צפייה בטווח שנבחר.</p>
  }

  const max = Math.max(...milestones.map((m) => m.users), 1)

  return (
    <div className="space-y-4">
      {unavailable && unavailableNote && (
        <p className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-muted">
          {unavailableNote}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-2">
        {milestones.map((m, i) => {
          const heightPct = Math.max(18, Math.round((m.users / max) * 100))
          const fromPrev = i > 0 ? stepRate(milestones[i - 1].users, m.users) : null
          return (
            <div key={m.label} className="flex flex-1 items-center gap-2 sm:flex-col sm:gap-2">
              {i > 0 && (
                <div className="flex shrink-0 items-center justify-center text-[10px] font-medium text-muted sm:order-first sm:h-5">
                  {fromPrev === null ? '→' : formatRate(fromPrev)}
                </div>
              )}
              <div className="flex flex-1 flex-col justify-end rounded-xl border border-border bg-surface px-3 py-3 sm:min-h-[7.5rem]">
                <div
                  className="mb-2 hidden w-full rounded-md bg-secondary/20 sm:block"
                  style={{ height: `${heightPct * 0.45}px` }}
                  aria-hidden
                />
                <p className="text-[11px] font-medium text-muted">{m.label}</p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {formatNumber(m.users)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {insight && (
        <p
          className={cn(
            'rounded-lg border px-3 py-2 text-xs leading-relaxed',
            insight.kind === 'positive'
              ? 'border-success/30 bg-success/5 text-foreground'
              : 'border-warning/30 bg-warning/5 text-foreground',
          )}
        >
          {insight.text}
        </p>
      )}
    </div>
  )
}
