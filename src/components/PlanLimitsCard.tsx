import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { UsageBar } from '@/components/ui/UsageBar'
import { FREE_PLAN_LIMITS, type LimitableEntity } from '@/lib/plans'
import type { PlanLimitInfo } from '@/hooks/usePlanLimits'

interface PlanLimitsCardProps {
  limits: Record<LimitableEntity, PlanLimitInfo>
  isFreePlan: boolean
}

const ENTITIES = Object.keys(FREE_PLAN_LIMITS) as LimitableEntity[]

export function PlanLimitsCard({ limits, isFreePlan }: PlanLimitsCardProps) {
  const navigate = useNavigate()

  if (!isFreePlan) return null

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-medium text-white">משחק התנסות</h3>

      <div className="space-y-3">
        {ENTITIES.map(entity => (
          <UsageBar key={entity} info={limits[entity]} entity={entity} />
        ))}
      </div>

      <div className="pt-2 border-t border-game-border text-center">
        <span className="text-xs text-gray-500">רוצים יותר? </span>
        <button
          onClick={() => navigate('/plans')}
          className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
        >
          צפו במסלולים להרחבת האירוע
        </button>
      </div>
    </Card>
  )
}
