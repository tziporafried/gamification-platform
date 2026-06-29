import { useState } from 'react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { RewardList } from '@/components/rewards/RewardList'
import type { EventCounts } from '@/types'

interface StepRewardsProps {
  eventId: string
  counts: EventCounts
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

export function StepRewards({ eventId, counts, onCountsRefresh, onNext, onBack }: StepRewardsProps) {
  const [localRewardCount, setLocalRewardCount] = useState(counts.rewards)

  function handleCountChange(count: number) {
    setLocalRewardCount(count)
    onCountsRefresh()
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
      <RewardList eventId={eventId} onCountChange={handleCountChange} variant="wizard" />
    </WizardStepWrapper>
  )
}
