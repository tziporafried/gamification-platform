import { useNavigate } from 'react-router-dom'
import { WizardStepWrapper } from './WizardStepWrapper'
import { QrCardGenerator } from '@/components/qr-cards/QrCardGenerator'
import type { Event, EventCounts } from '@/types'
import { isEventReady } from '@/lib/wizard'

interface StepReviewGenerateProps {
  event: Event
  counts: EventCounts
  onBack: () => void
}

export function StepReviewGenerate({ event, counts, onBack }: StepReviewGenerateProps) {
  const navigate = useNavigate()
  const ready = isEventReady(event, counts)

  function handleFinish() {
    navigate(`/events/${event.id}/control`)
  }

  return (
    <WizardStepWrapper
      title="סקירה והפקה"
      subtitle="בדוק שהכל מוכן והפק כרטיסים למשתתפים"
      currentStep={5}
      canAdvance={ready}
      onNext={handleFinish}
      onBack={onBack}
      nextLabel="למרכז הבקרה"
    >
      <div className="space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="משתתפים" value={counts.participants} />
          <SummaryCard label="משימות" value={counts.tasks} />
          <SummaryCard label="קבוצות" value={counts.groups} />
        </div>

        {/* Card generator */}
        <QrCardGenerator eventId={event.id} qrScoringMode={event.qr_scoring_mode} />
      </div>
    </WizardStepWrapper>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-game-border bg-game-card p-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}
