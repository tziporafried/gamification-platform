import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ReadinessChecklist } from './ReadinessChecklist'
import { QrCardGenerator } from '@/components/qr-cards/QrCardGenerator'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { syncEventToTemplate } from '@/lib/templates'
import type { Event, EventCounts, GroupType } from '@/types'
import { isEventReady, calculateReadiness, isTemplateReady, calculateTemplateReadiness } from '@/lib/wizard'

interface StepReviewGenerateProps {
  event: Event
  counts: EventCounts
  groupType: GroupType | null
  onGoToStep: (step: number) => void
  onBack: () => void
  templateMode?: {
    templateId: string
  }
}

export function StepReviewGenerate({
  event,
  counts,
  groupType,
  onGoToStep,
  onBack,
  templateMode,
}: StepReviewGenerateProps) {
  const navigate = useNavigate()
  const isTemplate = !!templateMode
  const ready = isTemplate
    ? isTemplateReady(event, counts, groupType)
    : isEventReady(event, counts, groupType)
  const checks = isTemplate
    ? calculateTemplateReadiness(event, counts, groupType)
    : calculateReadiness(event, counts, groupType)

  const [generateFn, setGenerateFn] = useState<(() => void) | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const handleReadyChange = useCallback((fn: (() => void) | null) => {
    setGenerateFn(() => fn)
  }, [])

  const footerBar = !isTemplate && generateFn ? (
    <div className="border-t border-game-border bg-game-dark px-4 py-3">
      <Button onClick={generateFn} className="w-full">
        <Printer size={16} className="ml-1.5" />הדפס כרטיסים
      </Button>
      <p className="text-center text-xs text-gray-500 mt-2">אפשר תמיד לחזור ולהדפיס שוב בהמשך.</p>
    </div>
  ) : null

  async function handleFinish() {
    if (isTemplate && templateMode) {
      setSaving(true)
      setSaveError('')
      try {
        if (groupType) {
          await syncEventToTemplate(event.id, templateMode.templateId, groupType)
        }
        navigate('/admin', { state: { tab: 'templates' } })
      } catch {
        setSaveError('שגיאה בסיום העריכה. נסו שוב.')
        setSaving(false)
      }
      return
    }

    if (event.status !== 'active') {
      await supabase.from('events').update({ status: 'active' }).eq('id', event.id)
    }
    navigate(`/events/${event.id}/control`)
  }

  return (
    <WizardStepWrapper
      title={isTemplate ? 'סיכום התבנית' : 'מוכנים להתחיל?'}
      subtitle={isTemplate
        ? 'השינויים נשמרים אוטומטית — בדקו שהכל נראה טוב'
        : 'בדקו שהכל מוכן לפני תחילת הפעילות'}
      currentStep={6}
      canAdvance={ready && !saving}
      onNext={handleFinish}
      onBack={onBack}
      nextLabel={isTemplate ? 'סיום עריכה' : 'התחל פעילות'}
      footerBar={footerBar}
    >
      <div className="space-y-4">
        {saveError && (
          <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">
            {saveError}
          </p>
        )}

        <div className={`grid gap-2 ${isTemplate ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {!isTemplate && <SummaryCard type="participants" value={counts.participants} />}
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
        ) : isTemplate ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-center space-y-1">
            <p className="text-base font-semibold text-emerald-300">התבנית מוכנה</p>
            <p className="text-sm text-gray-400">
              השינויים נשמרים אוטומטית. לחצו «סיום עריכה» לחזרה לניהול התבניות.
            </p>
            <div className="pt-2">
              <Button onClick={handleFinish} loading={saving} className="w-full sm:w-auto">
                סיום עריכה
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-center space-y-1">
              <p className="text-base font-semibold text-emerald-300">🎉 הפעילות מוכנה</p>
              <p className="text-sm text-gray-400">הכל מוכן! אפשר להדפיס את הכרטיסים ולהתחיל את הפעילות.</p>
            </div>
            <QrCardGenerator event={event} variant="wizard" onReadyChange={handleReadyChange} />
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
