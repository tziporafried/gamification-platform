import { useNavigate } from 'react-router-dom'
import { WizardStepWrapper } from './WizardStepWrapper'
import { QrCardGenerator } from '@/components/qr-cards/QrCardGenerator'
import { supabase } from '@/lib/supabase'
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

  async function handleFinish() {
    if (event.status !== 'active') {
      await supabase.from('events').update({ status: 'active' }).eq('id', event.id)
    }
    navigate(`/events/${event.id}/control`)
  }

  return (
    <WizardStepWrapper
      title="סקירה והדפסה"
      subtitle="בדוק שהכל מוכן והפק כרטיסים למשתתפים"
      currentStep={5}
      canAdvance={ready}
      onNext={handleFinish}
      onBack={onBack}
      nextLabel="למרכז הבקרה"
    >
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard label="משתתפים" value={counts.participants} />
          <SummaryCard label="משימות" value={counts.tasks} />
          <SummaryCard label="קבוצות" value={counts.groups} />
        </div>

        {/* Card generator */}
        <QrCardGenerator event={event} />
      </div>
    </WizardStepWrapper>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-game-border bg-game-card px-3 py-2 flex items-center justify-center gap-2">
      <span className="text-xl font-bold text-white">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )
}
