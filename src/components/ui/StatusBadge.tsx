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
  editing: '#f59e0b',
  active: '#34d399',
  archived: '#f87171',
  new: '#fbbf24',
  contacted: '#60a5fa',
  closed: '#9ca3af',
} as const

/** Plan badge color map */
export const PLAN_BADGE_COLORS: Record<string, string> = {
  free: '#9ca3af',
  independent: '#60a5fa',
  full: '#a78bfa',
  organizations: '#fbbf24',
}

/** Tailwind class presets for admin status pills (non-dynamic) */
export const ADMIN_STATUS_CLASSES: Record<string, string> = {
  new: 'text-amber-400 bg-amber-400/10',
  contacted: 'text-blue-400 bg-blue-400/10',
  closed: 'text-gray-400 bg-gray-400/10',
}

export function AdminStatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', ADMIN_STATUS_CLASSES[status] ?? ADMIN_STATUS_CLASSES.closed)}>
      {label}
    </span>
  )
}
