export const UPGRADE_CONTACT_EMAIL = 'zipi3637@gmail.com'

export const FREE_PLAN_LIMITS = {
  participants: 2,
  groups: 3,
  actions: 3,
  rewards: 3,
} as const

export type LimitableEntity = keyof typeof FREE_PLAN_LIMITS

export const ENTITY_LABELS: Record<LimitableEntity, string> = {
  participants: 'משתתפים',
  groups: 'קבוצות',
  actions: 'משימות',
  rewards: 'פרסים',
}

/** User-facing labels for free-plan limit helper text (e.g. wizard usage bars). */
export const FREE_PLAN_LIMIT_LABELS: Record<LimitableEntity, string> = {
  participants: 'משתתפים',
  groups: 'קבוצות',
  actions: 'פעילויות',
  rewards: 'פרסים',
}

export function formatFreePlanLimitHelper(entity: LimitableEntity, limit: number): string {
  return `עד ${limit} ${FREE_PLAN_LIMIT_LABELS[entity]} באירוע ההתנסות`
}

export function isPlanLimitError(message: string): LimitableEntity | null {
  const match = message.match(/PLAN_LIMIT_REACHED:(\w+)/)
  if (!match) return null
  const table = match[1] as string
  if (table in FREE_PLAN_LIMITS) return table as LimitableEntity
  return null
}
