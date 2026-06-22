import { useAuth } from '@/contexts/AuthContext'
import { useEventCounts } from './useEventCounts'
import { FREE_PLAN_LIMITS, type LimitableEntity } from '@/lib/plans'
import type { EventCounts } from '@/types'

export interface PlanLimitInfo {
  current: number
  limit: number | null
  isAtLimit: boolean
  isNearLimit: boolean
  plan: 'free' | 'paid'
}

type PlanLimits = Record<LimitableEntity, PlanLimitInfo> & {
  isFreePlan: boolean
  refresh: () => void
}

function makeLimitInfo(current: number, entity: LimitableEntity, isPaid: boolean): PlanLimitInfo {
  if (isPaid) {
    return { current, limit: null, isAtLimit: false, isNearLimit: false, plan: 'paid' }
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

function buildPlanLimits(counts: EventCounts, isFreePlan: boolean, refresh: () => void): PlanLimits {
  const isPaid = !isFreePlan
  return {
    participants: makeLimitInfo(counts.participants, 'participants', isPaid),
    groups: makeLimitInfo(counts.groups, 'groups', isPaid),
    actions: makeLimitInfo(counts.tasks, 'actions', isPaid),
    rewards: makeLimitInfo(counts.rewards, 'rewards', isPaid),
    isFreePlan,
    refresh,
  }
}

export function usePlanLimits(eventId: string): PlanLimits {
  const { isFreePlan } = useAuth()
  const { counts, refresh } = useEventCounts(eventId)
  return buildPlanLimits(counts, isFreePlan, refresh)
}

export function usePlanLimitsFromCounts(counts: EventCounts, refresh: () => void): PlanLimits {
  const { isFreePlan } = useAuth()
  return buildPlanLimits(counts, isFreePlan, refresh)
}
