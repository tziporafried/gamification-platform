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
  /** Base for relative % — typically video starters */
  baseUsers?: number
}

function relativeToBase(users: number, base: number): number | null {
  if (base <= 0) return null
  return Math.round((users / base) * 1000) / 10
}

export function VideoProgressTrack({
  milestones,
  loading,
  insight,
  unavailable,
  unavailableNote,
  baseUsers,
}: VideoProgressTrackProps) {
  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-surface-elevated" />
  }

  if (!milestones.length) {
    return <p className="text-sm text-muted">אין נתוני צפייה בטווח שנבחר.</p>
  }

  const base = baseUsers ?? milestones[0]?.users ?? 0
  const max = Math.max(...milestones.map((m) => m.users), 1)

  return (
    <div className="space-y-4">
      {unavailable && unavailableNote && (
        <p className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-muted">
          {unavailableNote}
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        {milestones.map((m, i) => {
          const widthPct = Math.max(22, Math.round((m.users / max) * 100))
          const ofBase = relativeToBase(m.users, base)
          return (
            <div key={m.label} className="w-full">
              <div className="mx-auto" style={{ width: `${widthPct}%`, minWidth: '10rem' }}>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-primary/10 px-3 py-2">
                  <span className="text-sm font-medium text-foreground">{m.label}</span>
                  <div className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-base font-bold text-foreground">
                      {formatNumber(m.users)}
                    </span>
                    {ofBase !== null && (
                      <span className="text-[11px] text-muted">{formatRate(ofBase)}</span>
                    )}
                  </div>
                </div>
              </div>
              {i < milestones.length - 1 && (
                <div className="flex justify-center py-0.5 text-[10px] text-muted">↓</div>
              )}
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
