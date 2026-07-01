import { useState } from 'react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ActionList } from '@/components/actions/ActionList'
import { UsageBar } from '@/components/ui/UsageBar'
import { WizardUsageScroll } from './WizardUsageScroll'
import { usePlanLimitsFromCounts } from '@/hooks/usePlanLimits'
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

export function StepTasks({ eventId, plan, counts, onCountsPatch, onCountsRefresh, onNext, onBack }: StepTasksProps) {
  const [localTaskCount, setLocalTaskCount] = useState(counts.tasks)
  const canAdvance = localTaskCount > 0
  const planLimits = usePlanLimitsFromCounts(counts, plan, onCountsRefresh)

  function handleCountChange(count: number) {
    setLocalTaskCount(count)
    onCountsPatch({ tasks: count })
  }

  const usageBar =
    planLimits.isFreePlan && planLimits.actions.limit !== null ? (
      <UsageBar info={planLimits.actions} entity="actions" />
    ) : null

  return (
    <WizardStepWrapper
      title="מה אפשר לעשות?"
      subtitle="הוסיפו פעילויות, אתגרים ומשימות שיעניקו נקודות למשתתפים"
      currentStep={4}
      canAdvance={canAdvance}
      onNext={onNext}
      onBack={onBack}
    >
      <WizardUsageScroll usageBar={usageBar}>
        <ActionList embedded eventId={eventId} onCountChange={handleCountChange} />
      </WizardUsageScroll>
    </WizardStepWrapper>
  )
}
