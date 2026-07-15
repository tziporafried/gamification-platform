import { formatNumber, formatRate } from './KpiCard'
import { SimpleDonut } from './SimpleDonut'
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
  startedUsers?: number
  completedUsers?: number
  reached25Users?: number | null
  reached50Users?: number | null
  reached75Users?: number | null
}

function relativeToBase(users: number, base: number): number | null {
  if (base <= 0) return null
  return Math.round((users / base) * 1000) / 10
}

const SLICE_COLORS = [
  'var(--color-secondary)',
  'var(--color-primary)',
  'var(--color-tertiary)',
  'var(--color-accent)',
  'var(--color-muted)',
]

/**
 * Build non-overlapping drop-off buckets from cumulative milestone counts.
 * Pie must not double-count users across stages.
 */
export function buildVideoDropoffSlices(params: {
  started: number
  completed: number
  reached25: number | null
  reached50: number | null
  reached75: number | null
  milestonesAvailable: boolean
}): { label: string; value: number; color: string }[] {
  const started = Math.max(0, params.started)
  const completed = Math.min(started, Math.max(0, params.completed))

  if (!params.milestonesAvailable || started <= 0) {
    const dropped = Math.max(0, started - completed)
    return [
      { label: 'סיימו', value: completed, color: SLICE_COLORS[0]! },
      { label: 'לא סיימו', value: dropped, color: SLICE_COLORS[4]! },
    ].filter((s) => s.value > 0)
  }

  // Cumulative — clamp so each stage ≤ previous (GA sampling can break order)
  let p75 = params.reached75
  let p50 = params.reached50
  let p25 = params.reached25

  p75 = p75 == null ? completed : Math.min(started, Math.max(completed, p75))
  p50 = p50 == null ? p75 : Math.min(started, Math.max(p75, p50))
  p25 = p25 == null ? p50 : Math.min(started, Math.max(p50, p25))

  const slices = [
    { label: 'סיימו', value: completed, color: SLICE_COLORS[0]! },
    { label: 'הגיעו ל־75% ולא סיימו', value: Math.max(0, p75 - completed), color: SLICE_COLORS[1]! },
    { label: 'נעצרו בין 50%–75%', value: Math.max(0, p50 - p75), color: SLICE_COLORS[2]! },
    { label: 'נעצרו בין 25%–50%', value: Math.max(0, p25 - p50), color: SLICE_COLORS[3]! },
    { label: 'יצאו לפני 25%', value: Math.max(0, started - p25), color: SLICE_COLORS[4]! },
  ]

  return slices.filter((s) => s.value > 0)
}

export function VideoProgressTrack({
  loading,
  insight,
  unavailable,
  unavailableNote,
  baseUsers,
  startedUsers,
  completedUsers,
  reached25Users,
  reached50Users,
  reached75Users,
}: VideoProgressTrackProps) {
  const started = startedUsers ?? baseUsers ?? 0
  const completed = completedUsers ?? 0
  const completionRate = relativeToBase(completed, started)

  const slices = buildVideoDropoffSlices({
    started,
    completed,
    reached25: reached25Users ?? null,
    reached50: reached50Users ?? null,
    reached75: reached75Users ?? null,
    milestonesAvailable: !unavailable,
  })

  return (
    <div className="space-y-4">
      {unavailable && unavailableNote && (
        <p className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-muted">
          {unavailableNote}
        </p>
      )}

      <SimpleDonut
        loading={loading}
        slices={slices}
        size="lg"
        showLegendPercent
        centerLabel="השלמה"
        centerValue={completionRate === null ? null : formatRate(completionRate)}
        emptyTitle="אין נתוני צפייה"
        emptyDescription="בטווח שנבחר אין צפיות בסרטון."
      />

      {!loading && started > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
          <span>
            התחילו:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {formatNumber(started)}
            </span>
          </span>
          <span>
            סיימו:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {formatNumber(completed)}
            </span>
          </span>
          {!unavailable && (
            <>
              <span>
                25%:{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatNumber(reached25Users ?? 0)}
                </span>
              </span>
              <span>
                50%:{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatNumber(reached50Users ?? 0)}
                </span>
              </span>
              <span>
                75%:{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatNumber(reached75Users ?? 0)}
                </span>
              </span>
            </>
          )}
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
