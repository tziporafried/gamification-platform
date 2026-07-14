/** Max successful scans allowed while an event is in trial (`plan = 'free'`). */
export const TRIAL_SCAN_LIMIT = 5

/**
 * Legacy free-plan entity caps. Trial mode no longer limits wizard building;
 * kept only so older helper types / UsageBar can still compile if referenced.
 * Limits are not enforced in DB or client anymore.
 */
export const FREE_PLAN_LIMITS = {
  participants: Number.POSITIVE_INFINITY,
  groups: Number.POSITIVE_INFINITY,
  actions: Number.POSITIVE_INFINITY,
  rewards: Number.POSITIVE_INFINITY,
} as const

export type LimitableEntity = keyof typeof FREE_PLAN_LIMITS

export const ENTITY_LABELS: Record<LimitableEntity, string> = {
  participants: 'משתתפים',
  groups: 'קבוצות',
  actions: 'משימות',
  rewards: 'פרסים',
}

/** @deprecated Trial mode no longer shows entity usage caps in the wizard. */
export const FREE_PLAN_LIMIT_LABELS: Record<LimitableEntity, string> = {
  participants: 'משתתפים',
  groups: 'קבוצות',
  actions: 'פעילויות',
  rewards: 'פרסים',
}

/** @deprecated */
export function formatFreePlanLimitHelper(entity: LimitableEntity, limit: number): string {
  return `עד ${limit} ${FREE_PLAN_LIMIT_LABELS[entity]} במצב התנסות`
}

export function isPlanLimitError(message: string): LimitableEntity | null {
  const match = message.match(/PLAN_LIMIT_REACHED:(\w+)/)
  if (!match) return null
  const table = match[1] as string
  if (table in FREE_PLAN_LIMITS) return table as LimitableEntity
  return null
}

/** Server-enforced trial scan quota exhausted (`check_trial_scan_limit` trigger). */
export function isTrialScanLimitError(message: string): boolean {
  return message.includes('TRIAL_SCAN_LIMIT_REACHED')
}
