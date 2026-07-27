import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, QrCode, ScanLine } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ScrollContainer } from '@/components/ui/ScrollContainer'
import { ReadinessChecklist } from './ReadinessChecklist'
import {
  ReadyCelebrationBanner,
  ReadyCelebrationOverlay,
  AnimatedPrintFooter,
  useStepEntryCelebration,
} from './ReadyCelebration'
import { EventSummaryGrid } from './EventSummaryGrid'
import { QrCardGenerator, type CardCounts } from '@/components/qr-cards/QrCardGenerator'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { syncEventToTemplate } from '@/lib/templates'
import type { Event, EventCounts, GroupType, ScanMode } from '@/types'
import { isEventReady, calculateReadiness, isTemplateReady, calculateTemplateReadiness } from '@/lib/wizard'
import { trackWizardStepComplete } from '@/lib/analytics'
import { getPendingActivation, clearPendingActivation } from '@/lib/contact'
import { usePlansModal } from '@/contexts/PlansModalContext'

/**
 * What the cards step decided, restated where the deck is actually printed -
 * with the way back, since the choice no longer lives on this screen.
 */
function ScanModeSummary({ scanMode, onChange }: { scanMode: ScanMode; onChange: () => void }) {
  const Icon = scanMode === 'split' ? ScanLine : QrCode

  return (
    <div className="mb-3 flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2">
      <Icon size={15} className="shrink-0 text-muted" />
      <span className="text-xs text-muted">
        סוג הכרטיסים: <span className="font-semibold text-foreground">
          {scanMode === 'split' ? 'סריקה כפולה' : 'סריקה בודדת'}
        </span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="mr-auto text-xs font-semibold text-primary-text underline-offset-2 hover:underline"
      >
        שינוי
      </button>
    </div>
  )
}

interface StepReviewGenerateProps {
  event: Event
  counts: EventCounts
  groupType: GroupType | null
  isActive: boolean
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
  isActive,
  onGoToStep,
  onBack,
  templateMode,
}: StepReviewGenerateProps) {
  const navigate = useNavigate()
  const { openPlans } = usePlansModal()
  const isTemplate = !!templateMode
  const ready = isTemplate
    ? isTemplateReady(event, counts, groupType)
    : isEventReady(event, counts, groupType)
  const checks = isTemplate
    ? calculateTemplateReadiness(event, counts, groupType)
    : calculateReadiness(event, counts, groupType)

  const [generateFn, setGenerateFn] = useState<(() => void) | null>(null)
  const [cardCounts, setCardCounts] = useState<CardCounts>({ combined: 0, split: 0 })
  const [cardsGenerated, setCardsGenerated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  // Answered in the cards step and kept on the event; the fallback is only for
  // games created before that step existed.
  const scanMode = event.scan_mode ?? 'combined'
  const { celebrate, animationKey } = useStepEntryCelebration(isActive, ready && !isTemplate)

  const handleReadyChange = useCallback((fn: (() => void) | null) => {
    setGenerateFn(() => fn)
  }, [])

  const handleCardCountsChange = useCallback((next: CardCounts) => {
    setCardCounts(next)
  }, [])

  const handleGeneratedChange = useCallback((generated: boolean) => {
    setCardsGenerated(generated)
  }, [])

  const footerBar = !isTemplate && generateFn ? (
    <AnimatedPrintFooter key={animationKey} celebrate={celebrate}>
      <Button onClick={() => generateFn()} className="w-full">
        <Eye size={16} className="ml-1.5" />סקור כרטיסים
      </Button>
    </AnimatedPrintFooter>
  ) : null

  async function handleFinish() {
    if (isTemplate && templateMode) {
      setSaving(true)
      setSaveError('')
      try {
        if (groupType) {
          await syncEventToTemplate(event.id, templateMode.templateId, groupType)
        }
        navigate('/admin/templates')
      } catch {
        setSaveError('שגיאה בסיום העריכה. נסו שוב.')
        setSaving(false)
      }
      return
    }

    if (event.status !== 'active') {
      await supabase.from('events').update({ status: 'active' }).eq('id', event.id)
    }
    trackWizardStepComplete(7, 'review')

    // Resume activation if user arrived via pricing without an event (self-service path).
    const pending = getPendingActivation()
    if (pending?.plan) {
      clearPendingActivation()
      navigate(`/events/${event.id}/control`)
      openPlans({
        eventId: event.id,
        plan: pending.plan,
        source: 'post_wizard',
      })
      return
    }

    navigate(`/events/${event.id}/control`)
  }

  return (
    <>
      {isActive && !isTemplate && (
        <ReadyCelebrationOverlay celebrate={celebrate} burstKey={animationKey} confettiLoop={ready} />
      )}

      <WizardStepWrapper
        title={isTemplate ? 'סיכום התבנית' : 'מוכנים לצאת לדרך?'}
        subtitle={isTemplate
          ? 'השינויים נשמרים אוטומטית - בדקו שהכל נראה טוב'
          : 'עברו על הסיכום האחרון. אם הכול נראה תקין, אפשר להתחיל את המשחק ולהזמין את המשתתפים.'}
        currentStep={7}
        canAdvance={ready && !saving}
        onNext={handleFinish}
        onBack={onBack}
        nextLabel={isTemplate ? 'סיום עריכה' : 'התחל את הפעילות'}
        footerBar={footerBar}
      >
        {isActive ? (
        <div key={animationKey} className="flex min-h-0 flex-1 flex-col overflow-hidden px-1">
          {saveError && (
            <p className="mb-3 shrink-0 rounded-lg bg-surface-elevated border border-danger px-3 py-2 text-sm text-danger-text">
              {saveError}
            </p>
          )}

          <AnimatePresence mode="wait">
            {!ready ? (
              <motion.div
                key={`checklist-${animationKey}`}
                className="flex min-h-0 flex-1 flex-col"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.25 }}
              >
                <div className="shrink-0 pb-3">
                  <EventSummaryGrid counts={counts} isTemplate={isTemplate} ready={ready} animationKey={animationKey} />
                </div>
                <ScrollContainer className="flex-1 min-h-0 px-0">
                  <ReadinessChecklist
                    checks={checks}
                    eventId={event.id}
                    onGoToStep={onGoToStep}
                  />
                </ScrollContainer>
              </motion.div>
            ) : isTemplate ? (
              <motion.div
                key={`template-ready-${animationKey}`}
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
                  <EventSummaryGrid counts={counts} isTemplate ready={ready} animationKey={animationKey} />
                </ReadyCelebrationBanner>
                <Button onClick={handleFinish} loading={saving} className="w-full shrink-0 sm:w-auto">
                  סיום עריכה
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key={`event-ready-${animationKey}`}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <div className={cardsGenerated ? 'mb-4 shrink-0' : 'mb-3'}>
                  <ReadyCelebrationBanner
                    title="🎉 הכול מוכן!"
                    description="המשחק מוכן להפעלה. אפשר להדפיס את הכרטיסים ולהתחיל את הפעילות."
                    celebrate={celebrate}
                    collapsed={cardsGenerated}
                    footerNote={cardsGenerated ? undefined : (scanMode === 'split'
                      ? 'יודפסו כרטיס לכל משתתף וכרטיס לכל פעילות - סורקים משתתף ואז פעילות.'
                      : 'לכל משתתף יודפס כרטיס אישי עם כל הפעילויות שהגדרתם.')}
                  >
                    <EventSummaryGrid
                      counts={counts}
                      ready={ready}
                      animationKey={animationKey}
                      showCards
                      totalCards={cardCounts[scanMode]}
                      compact={cardsGenerated}
                    />
                  </ReadyCelebrationBanner>
                </div>
                <ScanModeSummary scanMode={scanMode} onChange={() => onGoToStep(6)} />

                {/* Keep one QrCardGenerator instance - remounting would reset generated/print UI */}
                <ScrollContainer className="flex-1 px-0" stableGutter={false}>
                  <QrCardGenerator
                    event={event}
                    scanMode={scanMode}
                    onReadyChange={handleReadyChange}
                    onCardCountsChange={handleCardCountsChange}
                    onGeneratedChange={handleGeneratedChange}
                  />
                </ScrollContainer>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        ) : null}
      </WizardStepWrapper>
    </>
  )
}
