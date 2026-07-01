import { cn } from '@/lib/utils'
import { Badge } from './Badge'

interface StatusBadgeProps {
  label: string
  color: string
}

/** Thin wrapper around Badge for status/plan pills */
export function StatusBadge({ label, color }: StatusBadgeProps) {
  return <Badge label={label} color={color} />
}

/** Predefined status colors for common event/request states */
export const STATUS_COLORS = {
  editing: 'var(--color-warning)',
  active: 'var(--color-success)',
  archived: 'var(--color-danger)',
  new: 'var(--color-warning)',
  contacted: 'var(--color-secondary)',
  closed: 'var(--color-muted)',
} as const

/** Plan badge color map */
export const PLAN_BADGE_COLORS: Record<string, string> = {
  free: 'var(--color-muted)',
  independent: 'var(--color-secondary)',
  full: 'var(--color-primary)',
  organizations: 'var(--color-accent)',
}

/** Tailwind class presets for admin status pills (non-dynamic) */
export const ADMIN_STATUS_CLASSES: Record<string, string> = {
  new: 'text-warning bg-warning/10',
  contacted: 'text-secondary bg-secondary/10',
  closed: 'text-muted bg-muted/10',
}

export function AdminStatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', ADMIN_STATUS_CLASSES[status] ?? ADMIN_STATUS_CLASSES.closed)}>
      {label}
    </span>
  )
}
