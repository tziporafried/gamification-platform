import { useState } from 'react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { WizardUsageScroll } from './WizardUsageScroll'
import { RewardList } from '@/components/rewards/RewardList'
import type { EventCounts, UserPlan } from '@/types'

interface StepRewardsProps {
  eventId: string
  plan: UserPlan
  counts: EventCounts
  isActive: boolean
  onCountsPatch: (patch: Partial<EventCounts>) => void
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

export function StepRewards({ eventId, counts, isActive, onCountsPatch, onNext, onBack }: StepRewardsProps) {
  const [localRewardCount, setLocalRewardCount] = useState(counts.rewards)

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
      <WizardUsageScroll>
        <RewardList
          embedded
          eventId={eventId}
          isActive={isActive}
          groupCount={counts.groups}
          onCountChange={handleCountChange}
        />
      </WizardUsageScroll>
    </WizardStepWrapper>
  )
}
