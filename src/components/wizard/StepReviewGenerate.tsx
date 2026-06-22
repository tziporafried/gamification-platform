import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { QrCardGenerator } from '@/components/qr-cards/QrCardGenerator'
import { UsageBar } from '@/components/ui/UsageBar'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { FREE_PLAN_LIMITS, ENTITY_LABELS, type LimitableEntity } from '@/lib/plans'
import { Card } from '@/components/ui/Card'
import type { Event, EventCounts } from '@/types'
import { isEventReady } from '@/lib/wizard'

const CONTACT_EMAIL = 'zipi3637@gmail.com'
const ENTITIES = Object.keys(FREE_PLAN_LIMITS) as LimitableEntity[]

interface StepReviewGenerateProps {
  event: Event
  counts: EventCounts
  onBack: () => void
}

export function StepReviewGenerate({ event, counts, onBack }: StepReviewGenerateProps) {
  const navigate = useNavigate()
  const ready = isEventReady(event, counts)
  const planLimits = usePlanLimits(event.id)

  const hasWarning = planLimits.isFreePlan && ENTITIES.some(e => planLimits[e].isNearLimit)

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

        {/* Compact plan summary (free users only) */}
        {planLimits.isFreePlan && !hasWarning && (
          <div className="text-center space-y-1">
            <p className="text-xs text-gray-500">
              <span className="text-amber-400">מסלול חינמי</span>
              {' • '}
              {ENTITIES.map((e, i) => (
                <span key={e}>
                  {ENTITY_LABELS[e]}: {planLimits[e].current} מתוך {planLimits[e].limit}
                  {i < ENTITIES.length - 1 && ' • '}
                </span>
              ))}
            </p>
            <p className="text-[11px] text-gray-600">
              צריך יותר?{' '}
              <a href={`mailto:${CONTACT_EMAIL}?subject=שדרוג מסלול`} className="text-brand-400 hover:text-brand-300 transition-colors">
                צור קשר לשדרוג
              </a>
            </p>
          </div>
        )}

        {/* Warning state — expanded when near/at limits */}
        {hasWarning && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              <p className="text-sm font-medium text-amber-300">הגעת או מתקרב למגבלת המסלול החינמי</p>
            </div>
            <div className="space-y-2">
              {ENTITIES.filter(e => planLimits[e].isNearLimit).map(e => (
                <UsageBar key={e} info={planLimits[e]} entity={e} />
              ))}
            </div>
            <p className="text-[11px] text-gray-500 pt-1">
              צריך יותר?{' '}
              <a href={`mailto:${CONTACT_EMAIL}?subject=שדרוג מסלול`} className="text-brand-400 hover:text-brand-300 transition-colors">
                צור קשר לשדרוג
              </a>
            </p>
          </Card>
        )}

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
