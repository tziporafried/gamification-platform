import { useAuth } from '@/contexts/AuthContext'
import { useEventCounts } from './useEventCounts'
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

function buildPlanLimits(counts: EventCounts, plan: UserPlan, isFreePlan: boolean, refresh: () => void): PlanLimits {
  return {
    participants: makeLimitInfo(counts.participants, 'participants', plan),
    groups: makeLimitInfo(counts.groups, 'groups', plan),
    actions: makeLimitInfo(counts.tasks, 'actions', plan),
    rewards: makeLimitInfo(counts.rewards, 'rewards', plan),
    isFreePlan,
    refresh,
  }
}

export function usePlanLimits(eventId: string): PlanLimits {
  const { isFreePlan, profile } = useAuth()
  const plan = profile?.plan ?? 'free'
  const { counts, refresh } = useEventCounts(eventId)
  return buildPlanLimits(counts, plan, isFreePlan, refresh)
}

export function usePlanLimitsFromCounts(counts: EventCounts, refresh: () => void): PlanLimits {
  const { isFreePlan, profile } = useAuth()
  const plan = profile?.plan ?? 'free'
  return buildPlanLimits(counts, plan, isFreePlan, refresh)
}
