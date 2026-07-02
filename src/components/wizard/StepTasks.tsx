import { useState } from 'react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ActionList } from '@/components/actions/ActionList'
import { WizardUsageScroll } from './WizardUsageScroll'
import type { EventCounts, GroupType, UserPlan } from '@/types'

interface StepTasksProps {
  eventId: string
  plan: UserPlan
  counts: EventCounts
  groupType: GroupType | null
  onCountsPatch: (patch: Partial<EventCounts>) => void
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

export function StepTasks({ eventId, counts, groupType, onCountsPatch, onNext, onBack }: StepTasksProps) {
  const [localTaskCount, setLocalTaskCount] = useState(counts.tasks)
  const canAdvance = localTaskCount > 0

  function handleCountChange(count: number) {
    setLocalTaskCount(count)
    onCountsPatch({ tasks: count })
  }

  return (
    <WizardStepWrapper
      title="איך המשתתפים יצברו נקודות?"
      subtitle="צרו פעילויות, משימות ואתגרים שיעניקו נקודות לאורך המשחק. ככל שהמשימות מגוונות יותר – החוויה תהיה מהנה ומאתגרת יותר."
      currentStep={4}
      canAdvance={canAdvance}
      onNext={onNext}
      onBack={onBack}
    >
      <WizardUsageScroll className="h-full min-h-0 flex-1">
        <ActionList
          embedded
          eventId={eventId}
          groupType={groupType}
          groupCount={counts.groups}
          onCountChange={handleCountChange}
        />
      </WizardUsageScroll>
    </WizardStepWrapper>
  )
}
