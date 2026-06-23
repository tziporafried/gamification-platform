import { useNavigate } from 'react-router-dom'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ReadinessChecklist } from './ReadinessChecklist'
import { QrCardGenerator } from '@/components/qr-cards/QrCardGenerator'
import { supabase } from '@/lib/supabase'
import type { Event, EventCounts, GroupType } from '@/types'
import { isEventReady, calculateReadiness } from '@/lib/wizard'

interface StepReviewGenerateProps {
  event: Event
  counts: EventCounts
  groupType: GroupType | null
  onGoToStep: (step: number) => void
  onBack: () => void
}

export function StepReviewGenerate({ event, counts, groupType, onGoToStep, onBack }: StepReviewGenerateProps) {
  const navigate = useNavigate()
  const ready = isEventReady(event, counts, groupType)
  const checks = calculateReadiness(event, counts, groupType)

  async function handleFinish() {
    if (event.status !== 'active') {
      await supabase.from('events').update({ status: 'active' }).eq('id', event.id)
    }
    navigate(`/events/${event.id}/control`)
  }

  return (
    <WizardStepWrapper
      title="מוכנים להתחיל?"
      subtitle="בדקו שהכל מוכן לפני תחילת הפעילות"
      currentStep={5}
      canAdvance={ready}
      onNext={handleFinish}
      onBack={onBack}
      nextLabel="התחל פעילות"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard type="participants" value={counts.participants} />
          <SummaryCard type="activities" value={counts.tasks} />
          <SummaryCard type="groups" value={counts.groups} />
        </div>

        {!ready ? (
          <ReadinessChecklist
            checks={checks}
            eventId={event.id}
            variant="wizard"
            onGoToStep={onGoToStep}
          />
        ) : (
          <>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-center space-y-1">
              <p className="text-base font-semibold text-emerald-300">🎉 הפעילות מוכנה</p>
              <p className="text-sm text-gray-400">הכל מוכן! אפשר להדפיס את הכרטיסים ולהתחיל את הפעילות.</p>
            </div>
            <QrCardGenerator event={event} variant="wizard" />
          </>
        )}
      </div>
    </WizardStepWrapper>
  )
}

type SummaryCardType = 'participants' | 'activities' | 'groups'

function formatSummaryLabel(type: SummaryCardType, value: number): string {
  switch (type) {
    case 'participants':
      return value === 1 ? '1 משתתף' : `${value} משתתפים`
    case 'activities':
      return value === 1 ? '1 פעילות' : `${value} פעילויות`
    case 'groups':
      return value === 1 ? '1 קבוצה' : `${value} קבוצות`
  }
}

function SummaryCard({ type, value }: { type: SummaryCardType; value: number }) {
  const isAllTogether = type === 'groups' && value === 0

  return (
    <div className="rounded-xl border border-game-border bg-game-card px-3 py-2 flex items-center justify-center">
      <span className={isAllTogether ? 'text-sm text-gray-400' : 'text-sm font-bold text-white'}>
        {isAllTogether ? 'כולם יחד' : formatSummaryLabel(type, value)}
      </span>
    </div>
  )
}
