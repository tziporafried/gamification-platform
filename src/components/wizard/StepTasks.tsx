import { WizardStepWrapper } from './WizardStepWrapper'
import { ActionList } from '@/components/actions/ActionList'
import { UsageBar } from '@/components/ui/UsageBar'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import type { EventCounts } from '@/types'

interface StepTasksProps {
  eventId: string
  counts: EventCounts
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

export function StepTasks({ eventId, counts, onCountsRefresh, onNext, onBack }: StepTasksProps) {
  const canAdvance = counts.tasks > 0
  const planLimits = usePlanLimits(eventId)

  return (
    <WizardStepWrapper
      title="משימות"
      subtitle="הגדר את המשימות שהמשתתפים יוכלו לבצע"
      currentStep={4}
      canAdvance={canAdvance}
      onNext={onNext}
      onBack={onBack}
    >
      {planLimits.isFreePlan && (
        <UsageBar info={planLimits.actions} entity="actions" className="mb-4" />
      )}
      <ActionList eventId={eventId} onCountChange={onCountsRefresh} />
    </WizardStepWrapper>
  )
}
