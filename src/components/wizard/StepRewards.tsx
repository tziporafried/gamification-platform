import { useState } from 'react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ScrollContainer } from '@/components/ui/ScrollContainer'
import { UsageBar } from '@/components/ui/UsageBar'
import { RewardList } from '@/components/rewards/RewardList'
import { usePlanLimitsFromCounts } from '@/hooks/usePlanLimits'
import type { EventCounts, UserPlan } from '@/types'

interface StepRewardsProps {
  eventId: string
  plan: UserPlan
  counts: EventCounts
  onCountsPatch: (patch: Partial<EventCounts>) => void
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

export function StepRewards({ eventId, plan, counts, onCountsPatch, onCountsRefresh, onNext, onBack }: StepRewardsProps) {
  const [localRewardCount, setLocalRewardCount] = useState(counts.rewards)
  const planLimits = usePlanLimitsFromCounts(counts, plan, onCountsRefresh)

  function handleCountChange(count: number) {
    setLocalRewardCount(count)
    onCountsPatch({ rewards: count })
  }

  return (
    <WizardStepWrapper
      title="פרסים והפתעות"
      subtitle="הוסיפו פרסים שמשתתפים יוכלו לקבל לפי הנקודות שיצברו"
      currentStep={5}
      canAdvance={true}
      nextLabel={localRewardCount === 0 ? 'דלג' : 'המשך'}
      onNext={onNext}
      onBack={onBack}
    >
      <div className="flex h-full flex-col min-h-0">
        {planLimits.isFreePlan && planLimits.rewards.limit !== null && (
          <div className="shrink-0 pb-3">
            <UsageBar info={planLimits.rewards} entity="rewards" showCount={false} />
          </div>
        )}
        <ScrollContainer className="flex-1 py-1">
          <RewardList eventId={eventId} onCountChange={handleCountChange} />
        </ScrollContainer>
      </div>
    </WizardStepWrapper>
  )
}
