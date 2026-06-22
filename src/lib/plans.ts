export const FREE_PLAN_LIMITS = {
  participants: 10,
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

export function isPlanLimitError(message: string): LimitableEntity | null {
  const match = message.match(/PLAN_LIMIT_REACHED:(\w+)/)
  if (!match) return null
  const table = match[1] as string
  if (table in FREE_PLAN_LIMITS) return table as LimitableEntity
  return null
}
