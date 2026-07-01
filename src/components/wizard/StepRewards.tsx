import { useState } from 'react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { UsageBar } from '@/components/ui/UsageBar'
import { WizardUsageScroll } from './WizardUsageScroll'
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

  const usageBar =
    planLimits.isFreePlan && planLimits.rewards.limit !== null ? (
      <UsageBar info={planLimits.rewards} entity="rewards" />
    ) : null

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
      <WizardUsageScroll usageBar={usageBar}>
        <RewardList eventId={eventId} onCountChange={handleCountChange} />
      </WizardUsageScroll>
    </WizardStepWrapper>
  )
}
