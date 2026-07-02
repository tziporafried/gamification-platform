import { useState } from 'react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ParticipantList } from '@/components/participants/ParticipantList'
import { WizardUsageScroll } from './WizardUsageScroll'
import type { EventCounts, GroupType, UserPlan } from '@/types'

interface StepParticipantsProps {
  eventId: string
  plan: UserPlan
  counts: EventCounts
  groupType: GroupType | null
  isActive: boolean
  onCountsPatch: (patch: Partial<EventCounts>) => void
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

export function StepParticipants({
  eventId,
  counts,
  groupType,
  isActive,
  onCountsPatch,
  onNext,
  onBack,
}: StepParticipantsProps) {
  const [localParticipantCount, setLocalParticipantCount] = useState(counts.participants)
  const canAdvance = localParticipantCount > 0

  function handleCountChange(count: number) {
    setLocalParticipantCount(count)
    onCountsPatch({ participants: count })
  }

  return (
    <WizardStepWrapper
      title="מי משתתף?"
      subtitle="הוסיפו את כל המשתתפים בפעילות"
      currentStep={3}
      canAdvance={canAdvance}
      onNext={onNext}
      onBack={onBack}
    >
      <WizardUsageScroll className="h-full min-h-0 flex-1">
        <ParticipantList
          embedded
          eventId={eventId}
          groupType={groupType}
          isActive={isActive}
          onCountChange={handleCountChange}
        />
      </WizardUsageScroll>
    </WizardStepWrapper>
  )
}
