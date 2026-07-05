import { cn } from '@/lib/utils'

export type EventPlayStatusKind = 'preparing' | 'ready' | 'active'

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
    textClass: 'text-warning',
  },
  ready: {
    label: 'מוכן למשחק',
    color: 'var(--color-secondary)',
    dotClass: 'bg-secondary',
    textClass: 'text-secondary',
  },
  active: {
    label: 'משחק פעיל',
    color: 'var(--color-success)',
    dotClass: 'bg-success',
    textClass: 'text-success',
  },
}

export function resolveEventPlayStatus(ready: boolean, totalScans: number): EventPlayStatusKind {
  if (!ready) return 'preparing'
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
