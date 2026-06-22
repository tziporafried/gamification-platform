import { Card } from '@/components/ui/Card'
import { UsageBar } from '@/components/ui/UsageBar'
import { FREE_PLAN_LIMITS, type LimitableEntity } from '@/lib/plans'
import type { PlanLimitInfo } from '@/hooks/usePlanLimits'

interface PlanLimitsCardProps {
  limits: Record<LimitableEntity, PlanLimitInfo>
  isFreePlan: boolean
}

const CONTACT_EMAIL = 'zipi3637@gmail.com'
const ENTITIES = Object.keys(FREE_PLAN_LIMITS) as LimitableEntity[]

export function PlanLimitsCard({ limits, isFreePlan }: PlanLimitsCardProps) {
  if (!isFreePlan) return null

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-medium text-white">המסלול שלך: חינמי</h3>

      <div className="space-y-3">
        {ENTITIES.map(entity => (
          <UsageBar key={entity} info={limits[entity]} entity={entity} />
        ))}
      </div>

      <div className="pt-2 border-t border-game-border text-center">
        <span className="text-xs text-gray-500">צריך יותר? </span>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=שדרוג מסלול`}
          className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
        >
          צור קשר לשדרוג
        </a>
      </div>
    </Card>
  )
}
