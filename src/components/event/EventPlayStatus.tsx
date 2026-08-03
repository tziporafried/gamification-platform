import { cn } from '@/lib/utils'
import type { UserPlan } from '@/types'

export type EventPlayStatusKind =
  | 'preparing'
  | 'settings_complete'
  | 'awaiting_activation'
  | 'ready'
  | 'active'

export interface EventPlayStatusConfig {
  label: string
  color: string
  dotClass: string
  textClass: string
}

export const EVENT_PLAY_STATUS: Record<EventPlayStatusKind, EventPlayStatusConfig> = {
  preparing: {
    label: 'בהכנה',
    color: 'var(--color-warning)',
    dotClass: 'bg-warning',
    textClass: 'text-warning-text',
  },
  settings_complete: {
    label: 'ההגדרות הושלמו',
    color: 'var(--color-secondary)',
    dotClass: 'bg-secondary',
    textClass: 'text-secondary-text',
  },
  awaiting_activation: {
    label: 'ממתין להפעלה',
    color: 'var(--color-primary)',
    dotClass: 'bg-primary',
    textClass: 'text-primary-text',
  },
  ready: {
    label: 'מוכן למשחק',
    color: 'var(--color-secondary)',
    dotClass: 'bg-secondary',
    textClass: 'text-secondary-text',
  },
  active: {
    label: 'משחק פעיל',
    color: 'var(--color-success)',
    dotClass: 'bg-success',
    textClass: 'text-success-text',
  },
}

export const ACTIVATION_MODE_LABELS: Record<UserPlan, string> = {
  free: 'התנסות',
  independent: 'משחק עצמאי',
  full: 'משחק מלא',
  offline: 'משחק ללא חיבור לאינטרנט',
  organizations: 'פתרון לארגונים',
}

/**
 * The badge and the click have to agree. Every kind below names where pressing
 * the event actually lands the owner:
 *   preparing / settings_complete → the wizard, wherever they left off
 *   awaiting_activation           → the wizard's start step
 *   ready / active                → the control center
 * `isStarted` is `events.status === 'active'` - the DB flag the scan screen
 * itself runs on. Without it a game that was never started still read as
 * "מוכן למשחק" while the click sent its owner back into the wizard.
 */
export function resolveEventPlayStatus(
  ready: boolean,
  totalScans: number,
  opts?: { isTrial?: boolean; isStarted?: boolean },
): EventPlayStatusKind {
  if (!ready) return 'preparing'
  if (opts?.isTrial) return 'settings_complete'
  if (opts?.isStarted === false) return 'awaiting_activation'
  if (totalScans > 0) return 'active'
  return 'ready'
}

function StatusDot({ status, pulse }: { status: EventPlayStatusKind; pulse?: boolean }) {
  const { dotClass } = EVENT_PLAY_STATUS[status]
  const showPulse = pulse ?? status !== 'preparing'

  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {showPulse && (
        <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', dotClass)} />
      )}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', dotClass)} />
    </span>
  )
}

interface EventPlayStatusProps {
  status: EventPlayStatusKind
}

export function EventPlayStatusPreparing(props: Omit<EventPlayStatusProps, 'status'>) {
  return <EventPlayStatus status="preparing" {...props} />
}

export function EventPlayStatusReady(props: Omit<EventPlayStatusProps, 'status'>) {
  return <EventPlayStatus status="ready" {...props} />
}

export function EventPlayStatusActive(props: Omit<EventPlayStatusProps, 'status'>) {
  return <EventPlayStatus status="active" {...props} />
}

export function EventPlayStatus({ status }: EventPlayStatusProps) {
  const config = EVENT_PLAY_STATUS[status]

  return (
    <div className="flex items-center gap-2">
      <StatusDot status={status} />
      <span className={cn('text-xs font-semibold', config.textClass)}>{config.label}</span>
    </div>
  )
}
