import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ScrollContainer } from '@/components/ui/ScrollContainer'
import { ReadinessChecklist } from './ReadinessChecklist'
import { ReadyCelebrationBanner } from './ReadyCelebration'
import { EventSummaryGrid } from './EventSummaryGrid'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { syncEventToTemplate } from '@/lib/templates'
import type { Event, EventCounts, GroupType } from '@/types'
import { isTemplateReady, calculateTemplateReadiness } from '@/lib/wizard'

interface StepTemplateSummaryProps {
  /** The draft event standing in for the template being edited. */
  event: Event
  counts: EventCounts
  groupType: GroupType | null
  isActive: boolean
  templateId: string
  onGoToStep: (step: number) => void
  onBack: () => void
}

/**
 * Step 7 - where editing a template ends.
 *
 * A game finishes on the cards step, which prints its deck and opens the game;
 * a template has nobody to print for and nothing to open, so it gets this
 * screen instead: what the template contains, and the button that saves the
 * editing session. Games never see step 7 (EVENT_SKIP_STEPS).
 */
export function StepTemplateSummary({
  event,
  counts,
  groupType,
  isActive,
  templateId,
  onGoToStep,
  onBack,
}: StepTemplateSummaryProps) {
  const navigate = useNavigate()
  const ready = isTemplateReady(event, counts, groupType)
  const checks = calculateTemplateReadiness(event, counts, groupType)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function handleFinish() {
    setSaving(true)
    setSaveError('')
    try {
      if (groupType) {
        await syncEventToTemplate(event.id, templateId, groupType)
      }
      navigate('/admin/templates')
    } catch {
      setSaveError('שגיאה בסיום העריכה. נסו שוב.')
      setSaving(false)
    }
  }

  return (
    <WizardStepWrapper
      title="סיכום התבנית"
      subtitle="השינויים נשמרים אוטומטית - בדקו שהכל נראה טוב"
      currentStep={8}
      // A template's last step, so the CTA is an ending and carries no arrow.
      totalSteps={8}
      canAdvance={ready && !saving}
      onNext={handleFinish}
      onBack={onBack}
      nextLabel="סיום עריכה"
    >
      {isActive ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1">
        {saveError && <Alert variant="error" message={saveError} className="mb-3 shrink-0" />}

        <AnimatePresence mode="wait">
          {!ready ? (
            <motion.div
              key="checklist"
              className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25 }}
            >
              <div className="shrink-0 pb-3">
                <EventSummaryGrid counts={counts} isTemplate ready={ready} showRewards />
              </div>
              <ScrollContainer className="flex-1 min-h-0 px-0">
                <ReadinessChecklist checks={checks} eventId={event.id} onGoToStep={onGoToStep} />
              </ScrollContainer>
            </motion.div>
          ) : (
            <motion.div
              key="ready"
              className="flex min-h-0 flex-1 flex-col gap-3"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            >
              <ReadyCelebrationBanner
                title="התבנית מוכנה"
                description="השינויים נשמרים אוטומטית. לחצו «סיום עריכה» לחזרה לניהול התבניות."
                celebrate={false}
              >
                <EventSummaryGrid counts={counts} isTemplate ready={ready} showRewards />
              </ReadyCelebrationBanner>
              <Button onClick={handleFinish} loading={saving} className="w-full shrink-0 sm:w-auto">
                סיום עריכה
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      ) : null}
    </WizardStepWrapper>
  )
}
