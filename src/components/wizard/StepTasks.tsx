import { useState } from 'react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ActionList } from '@/components/actions/ActionList'
import { WizardUsageScroll } from './WizardUsageScroll'
import type { EventCounts, UserPlan } from '@/types'

interface StepTasksProps {
  eventId: string
  plan: UserPlan
  counts: EventCounts
  onCountsPatch: (patch: Partial<EventCounts>) => void
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

export function StepTasks({ eventId, counts, onCountsPatch, onNext, onBack }: StepTasksProps) {
  const [localTaskCount, setLocalTaskCount] = useState(counts.tasks)
  const canAdvance = localTaskCount > 0

  function handleCountChange(count: number) {
    setLocalTaskCount(count)
    onCountsPatch({ tasks: count })
  }

  return (
    <WizardStepWrapper
      title="מה אפשר לעשות?"
      subtitle="הוסיפו פעילויות, אתגרים ומשימות שיעניקו נקודות למשתתפים"
      currentStep={4}
      canAdvance={canAdvance}
      onNext={onNext}
      onBack={onBack}
    >
      <WizardUsageScroll>
        <ActionList embedded eventId={eventId} onCountChange={handleCountChange} />
      </WizardUsageScroll>
    </WizardStepWrapper>
  )
}
