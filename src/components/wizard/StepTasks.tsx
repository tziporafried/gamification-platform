import { useState } from 'react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ActionList } from '@/components/actions/ActionList'
import { UsageBar } from '@/components/ui/UsageBar'
import { usePlanLimitsFromCounts } from '@/hooks/usePlanLimits'
import type { EventCounts } from '@/types'

interface StepTasksProps {
  eventId: string
  counts: EventCounts
  onCountsPatch: (patch: Partial<EventCounts>) => void
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

export function StepTasks({ eventId, counts, onCountsPatch, onCountsRefresh, onNext, onBack }: StepTasksProps) {
  const [localTaskCount, setLocalTaskCount] = useState(counts.tasks)
  const canAdvance = localTaskCount > 0
  const planLimits = usePlanLimitsFromCounts(counts, onCountsRefresh)

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
      <div className="flex h-full flex-col">
        <div className="shrink-0 space-y-3 pb-3">
          {localTaskCount > 0 && (
            <p className="text-xs text-gray-400 text-center">
              {localTaskCount} פעילויות הוגדרו
            </p>
          )}
          {planLimits.isFreePlan && planLimits.actions.limit !== null && (
            <UsageBar
              info={planLimits.actions}
              entity="actions"
              showCount={false}
            />
          )}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 pl-1" style={{ scrollbarGutter: 'stable' }}>
          <ActionList eventId={eventId} onCountChange={handleCountChange} variant="wizard" />
        </div>
      </div>
    </WizardStepWrapper>
  )
}
