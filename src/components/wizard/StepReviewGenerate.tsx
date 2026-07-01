import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ScrollContainer } from '@/components/ui/ScrollContainer'
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
    <div className="border-t border-border/70 px-4 py-3">
      <Button onClick={generateFn} className="w-full">
        <Printer size={16} className="ml-1.5" />הדפס כרטיסים
      </Button>
      <p className="text-center text-xs text-muted mt-2">אפשר תמיד לחזור ולהדפיס שוב בהמשך.</p>
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
      <ScrollContainer className="flex-1">
      <div className="space-y-4">
        {saveError && (
          <p className="rounded-lg bg-surface-elevated border border-danger px-3 py-2 text-sm text-danger">
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
            onGoToStep={onGoToStep}
          />
        ) : isTemplate ? (
          <div className="rounded-2xl border border-success bg-surface-elevated px-5 py-4 text-center space-y-1">
            <p className="text-base font-semibold text-success">התבנית מוכנה</p>
            <p className="text-sm text-muted">
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
            <div className="rounded-2xl border border-success bg-surface-elevated px-5 py-4 text-center space-y-1">
              <p className="text-base font-semibold text-success">🎉 הפעילות מוכנה</p>
              <p className="text-sm text-muted">הכל מוכן! אפשר להדפיס את הכרטיסים ולהתחיל את הפעילות.</p>
            </div>
            <QrCardGenerator event={event} onReadyChange={handleReadyChange} />
          </>
        )}
      </div>
      </ScrollContainer>
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
    <div className="rounded-xl border border-border bg-surface px-3 py-2 flex items-center justify-center">
      <span className={isAllTogether ? 'text-sm text-muted' : 'text-sm font-bold text-foreground'}>
        {isAllTogether ? 'כולם יחד' : formatSummaryLabel(type, value)}
      </span>
    </div>
  )
}
