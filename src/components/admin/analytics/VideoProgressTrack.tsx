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

function calcStepRate(from: number, to: number): number | null {
  if (from <= 0) return null
  return Math.round((to / from) * 1000) / 10
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
    return <div className="h-40 animate-pulse rounded-xl bg-surface-elevated" />
  }

  if (!milestones.length) {
    return <p className="text-sm text-muted">אין נתוני צפייה בטווח שנבחר.</p>
  }

  const base = baseUsers ?? milestones[0]?.users ?? 0
  const last = milestones[milestones.length - 1]
  const completionRate = relativeToBase(last.users, base)

  return (
    <div className="space-y-5">
      {unavailable && unavailableNote && (
        <p className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-muted">
          {unavailableNote}
        </p>
      )}

      {/* Scrubber-style milestone track */}
      <div className="overflow-x-auto">
        <div
          className="relative mx-auto px-1 pt-1"
          style={{ minWidth: `${Math.max(milestones.length * 5.5, 18)}rem` }}
        >
          <div
            className="absolute inset-x-8 top-[1.125rem] h-1.5 rounded-full"
            style={{
              background:
                'color-mix(in srgb, var(--color-secondary) 45%, var(--color-border))',
            }}
            aria-hidden
          />

          <ol
            className="relative grid gap-2"
            style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))` }}
          >
            {milestones.map((m, i) => {
              const ofBase = relativeToBase(m.users, base)
              const fromPrev =
                i > 0 ? calcStepRate(milestones[i - 1].users, m.users) : null
              const isFirst = i === 0
              const isLast = i === milestones.length - 1

              return (
                <li key={m.label} className="flex flex-col items-center text-center">
                  <div
                    className={cn(
                      'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold shadow-sm',
                      isLast
                        ? 'border-secondary bg-secondary text-secondary-foreground'
                        : isFirst
                          ? 'border-secondary bg-secondary text-secondary-foreground'
                          : 'border-secondary bg-surface text-foreground',
                    )}
                  >
                    {isLast ? '✓' : i + 1}
                  </div>

                  <p className="mt-3 text-xs font-semibold text-foreground">{m.label}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                    {formatNumber(m.users)}
                  </p>
                  {ofBase !== null && (
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted">
                      {formatRate(ofBase)} מהמתחילים
                    </p>
                  )}
                  {fromPrev !== null && (
                    <p className="mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted"
                      style={{
                        background:
                          'color-mix(in srgb, var(--color-muted) 10%, transparent)',
                      }}
                    >
                      {formatRate(fromPrev)} מהקודם
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      {completionRate !== null && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated/60 px-4 py-3">
          <p className="text-xs text-muted">השלימו את הסרטון</p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {formatRate(completionRate)}
          </p>
        </div>
      )}

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
