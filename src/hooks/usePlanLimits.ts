import { FREE_PLAN_LIMITS, type LimitableEntity } from '@/lib/plans'
import type { EventCounts, UserPlan } from '@/types'

export interface PlanLimitInfo {
  current: number
  limit: number | null
  isAtLimit: boolean
  isNearLimit: boolean
  plan: UserPlan
}

type PlanLimits = Record<LimitableEntity, PlanLimitInfo> & {
  isFreePlan: boolean
  refresh: () => void
}

function makeLimitInfo(current: number, entity: LimitableEntity, plan: UserPlan): PlanLimitInfo {
  if (plan !== 'free') {
    return { current, limit: null, isAtLimit: false, isNearLimit: false, plan }
  }
  const limit = FREE_PLAN_LIMITS[entity]
  return {
    current,
    limit,
    isAtLimit: current >= limit,
    isNearLimit: current >= Math.ceil(limit * 0.8),
    plan: 'free',
  }
}

export function usePlanLimitsFromCounts(
  counts: EventCounts,
  plan: UserPlan,
  refresh: () => void,
): PlanLimits {
  const isFreePlan = plan === 'free'
  return {
    participants: makeLimitInfo(counts.participants, 'participants', plan),
    groups: makeLimitInfo(counts.groups, 'groups', plan),
    actions: makeLimitInfo(counts.tasks, 'actions', plan),
    rewards: makeLimitInfo(counts.rewards, 'rewards', plan),
    isFreePlan,
    refresh,
  }
}
