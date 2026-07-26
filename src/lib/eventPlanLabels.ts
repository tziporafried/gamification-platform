import type { UserPlan } from '@/types'

/**
 * Hebrew names for the plans, as the admin screens show them.
 *
 * One map, because the games list and the bookings board each grew their own
 * and they had already drifted - the list had no label for 'offline' and fell
 * back to printing the raw key.
 */
export const PLAN_LABELS: Record<UserPlan, string> = {
  free: 'התנסות',
  independent: 'עצמאי',
  full: 'מלא',
  offline: 'ללא אינטרנט',
  organizations: 'ארגונים',
}

/** Plan picker order, cheapest first. */
export const EVENT_PLAN_OPTIONS: { value: UserPlan; label: string }[] = [
  'free',
  'independent',
  'full',
  'offline',
  'organizations',
].map((value) => ({ value: value as UserPlan, label: PLAN_LABELS[value as UserPlan] }))

export function eventPlanLabel(plan: string | undefined | null): string {
  if (!plan) return '-'
  return PLAN_LABELS[plan as UserPlan] ?? plan
}
