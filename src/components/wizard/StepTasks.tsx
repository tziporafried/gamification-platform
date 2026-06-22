import { useState } from 'react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ActionList } from '@/components/actions/ActionList'
import { UsageBar } from '@/components/ui/UsageBar'
import { usePlanLimitsFromCounts } from '@/hooks/usePlanLimits'
import type { EventCounts } from '@/types'

interface StepTasksProps {
  eventId: string
  counts: EventCounts
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

export function StepTasks({ eventId, counts, onCountsRefresh, onNext, onBack }: StepTasksProps) {
  const [localTaskCount, setLocalTaskCount] = useState(counts.tasks)
  const canAdvance = localTaskCount > 0
  const planLimits = usePlanLimitsFromCounts(counts, onCountsRefresh)

  function handleCountChange(count: number) {
    setLocalTaskCount(count)
    onCountsRefresh()
    planLimits.refresh()
  }

  return (
    <WizardStepWrapper
      title="משימות"
      subtitle="הגדר את המשימות שהמשתתפים יוכלו לבצע"
      currentStep={4}
      canAdvance={canAdvance}
      onNext={onNext}
      onBack={onBack}
    >
      <div className="flex h-full flex-col">
        <div className="shrink-0">
          <div className="mb-2 text-sm text-gray-400">{localTaskCount} משימות</div>
          {planLimits.isFreePlan && (
            <UsageBar info={planLimits.actions} entity="actions" className="mb-4" />
          )}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <ActionList eventId={eventId} onCountChange={handleCountChange} />
        </div>
      </div>
    </WizardStepWrapper>
  )
}
