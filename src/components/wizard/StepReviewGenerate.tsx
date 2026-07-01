import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Printer } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ScrollContainer } from '@/components/ui/ScrollContainer'
import { ReadinessChecklist } from './ReadinessChecklist'
import {
  ReadyCelebrationBanner,
  ReadyCelebrationOverlay,
  AnimatedSummaryCard,
  AnimatedPrintFooter,
  useStepEntryCelebration,
  getSummaryCardVariantStyles,
  type SummaryCardVariant,
} from './ReadyCelebration'
import { QrCardGenerator } from '@/components/qr-cards/QrCardGenerator'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { syncEventToTemplate } from '@/lib/templates'
import type { Event, EventCounts, GroupType } from '@/types'
import { isEventReady, calculateReadiness, isTemplateReady, calculateTemplateReadiness } from '@/lib/wizard'

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
  const { celebrate, animationKey } = useStepEntryCelebration(isActive, ready && !isTemplate)

  const handleReadyChange = useCallback((fn: (() => void) | null) => {
    setGenerateFn(() => fn)
  }, [])

  const footerBar = !isTemplate && generateFn ? (
    <AnimatedPrintFooter key={animationKey} celebrate={celebrate}>
      <Button onClick={generateFn} className="w-full">
        <Printer size={16} className="ml-1.5" />הדפס כרטיסים
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
    <>
      {isActive && !isTemplate && <ReadyCelebrationOverlay celebrate={celebrate} burstKey={animationKey} />}

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
        {isActive ? (
        <div key={animationKey} className="flex h-full min-h-0 flex-col px-1">
          <div className="shrink-0 space-y-4 pb-3">
            {saveError && (
              <p className="rounded-lg bg-surface-elevated border border-danger px-3 py-2 text-sm text-danger">
                {saveError}
              </p>
            )}

            <div className={`grid gap-2 overflow-visible ${isTemplate ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {!isTemplate && (
                <SummaryCard type="participants" value={counts.participants} index={0} ready={ready} animationKey={animationKey} />
              )}
              <SummaryCard type="activities" value={counts.tasks} index={isTemplate ? 0 : 1} ready={ready} animationKey={animationKey} />
              <SummaryCard type="groups" value={counts.groups} index={isTemplate ? 1 : 2} ready={ready} animationKey={animationKey} />
            </div>
          </div>

          <ScrollContainer className="flex-1 min-h-0 px-0">
          <AnimatePresence mode="wait">
            {!ready ? (
              <motion.div
                key={`checklist-${animationKey}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.25 }}
              >
                <ReadinessChecklist
                  checks={checks}
                  eventId={event.id}
                  onGoToStep={onGoToStep}
                />
              </motion.div>
            ) : isTemplate ? (
              <motion.div
                key={`template-ready-${animationKey}`}
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              >
                <ReadyCelebrationBanner
                  replayKey={animationKey}
                  title="התבנית מוכנה"
                  description="השינויים נשמרים אוטומטית. לחצו «סיום עריכה» לחזרה לניהול התבניות."
                  celebrate={false}
                />
                <div className="pt-3">
                  <Button onClick={handleFinish} loading={saving} className="w-full sm:w-auto">
                    סיום עריכה
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`event-ready-${animationKey}`}
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <ReadyCelebrationBanner
                  replayKey={animationKey}
                  title="הפעילות מוכנה"
                  description="הכל מוכן! אפשר להדפיס את הכרטיסים ולהתחיל את הפעילות."
                  celebrate={celebrate}
                />
                <motion.div
                  key={`qr-${animationKey}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.35 }}
                >
                  <QrCardGenerator event={event} onReadyChange={handleReadyChange} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          </ScrollContainer>
        </div>
        ) : null}
      </WizardStepWrapper>
    </>
  )
}

type SummaryCardType = SummaryCardVariant

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

function SummaryCard({
  type,
  value,
  index,
  ready,
  animationKey,
}: {
  type: SummaryCardType
  value: number
  index: number
  ready: boolean
  animationKey: number
}) {
  const isAllTogether = type === 'groups' && value === 0
  const label = isAllTogether ? 'כולם יחד' : formatSummaryLabel(type, value)
  const variantStyles = getSummaryCardVariantStyles(type)

  const content = (
    <span className={isAllTogether ? 'text-sm text-muted' : 'text-sm font-bold text-foreground'}>
      {label}
    </span>
  )

  if (!ready) {
    return (
      <div className={cn(
        'rounded-xl px-3 py-2 flex items-center justify-center',
        variantStyles.card,
      )}>
        {content}
      </div>
    )
  }

  return (
    <AnimatedSummaryCard key={`${animationKey}-${index}`} index={index} variant={type} highlight={ready}>
      {content}
    </AnimatedSummaryCard>
  )
}
