import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode, ScanLine, Printer, Eye, Check, Info, Rocket } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { WizardSegmentedChoice, type SegmentedChoiceOption } from './WizardSegmentedChoice'
import { EventSummaryGrid } from './EventSummaryGrid'
import { ReadinessChecklist } from './ReadinessChecklist'
import { ReadyCelebrationBanner, ReadyCelebrationOverlay, useStepEntryCelebration } from './ReadyCelebration'
import { ScrollContainer } from '@/components/ui/ScrollContainer'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { QrCardGenerator } from '@/components/qr-cards/QrCardGenerator'
import { supabase } from '@/lib/supabase'
import { useCardCounts } from '@/hooks/useCardCounts'
import { isEventReady, calculateReadiness } from '@/lib/wizard'
import { trackWizardStepComplete } from '@/lib/analytics'
import { getPendingActivation, clearPendingActivation } from '@/lib/contact'
import { usePlansModal } from '@/contexts/PlansModalContext'
import type { CardCounts } from '@/lib/cardCounts'
import type { Event, EventCounts, GroupType, ScanMode } from '@/types'

interface StepCardsProps {
  event: Event
  counts: EventCounts
  groupType: GroupType | null
  isActive: boolean
  /** The saved choice goes back to the wizard, which owns the event row. */
  onEventUpdated: (event: Event) => void
  onGoToStep: (step: number) => void
  onBack: () => void
}

/** The step is one page in two acts - preparing the cards, then done. */
type Phase = 'prepare' | 'done'

const he = (n: number) => n.toLocaleString('he-IL')

/**
 * What each deck costs to print, under the sentence that explains it: what the
 * deck is made of, then the total it adds up to. A total on its own says
 * nothing - 55 cards means one thing as "one per player plus one per task" and
 * something else entirely as a card per pairing.
 */
function DeckDetail({ mode, counts, loading }: { mode: ScanMode; counts: CardCounts; loading: boolean }) {
  if (loading) return <span className="text-muted/70">מחשב…</span>

  return (
    <>
      <span className="block leading-relaxed text-muted/75">
        {mode === 'split'
          ? `${he(counts.participantCards)} כרטיסי משתתף · ${he(counts.actionCards)} כרטיסי משימה`
          : `${he(counts.participantCards)} משתתפים · כרטיס לכל משימה שרלוונטית להם`}
      </span>
      <span className="mt-1 block font-semibold text-foreground/70">
        סה״כ {he(counts[mode])} כרטיסים להדפסה
      </span>
    </>
  )
}

/**
 * The last step of the wizard for a game, in two acts on one page.
 *
 * First the cards: which deck, a preview if wanted, and printing. Then - once
 * the operator confirms the cards came out of the printer - the same page turns
 * into the wizard's ending, with the checklist of what was built and the button
 * that opens the game. Confirming is a click rather than something we detect,
 * because a print dialog tells us nothing about what actually got printed.
 *
 * (A template ends on StepTemplateSummary instead - it has nobody to print for.)
 */
export function StepCards({
  event,
  counts,
  groupType,
  isActive,
  onEventUpdated,
  onGoToStep,
  onBack,
}: StepCardsProps) {
  const navigate = useNavigate()
  const { openPlans } = usePlansModal()
  const { cardCounts, loading } = useCardCounts(event.id, isActive)
  const [phase, setPhase] = useState<Phase>('prepare')
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [printFn, setPrintFn] = useState<(() => void) | null>(null)
  // The deck laid out inside the dialog can print itself. Preferred while the
  // dialog is open so printing reads the cards already on screen instead of
  // making the step's own copy build a second deck.
  const [previewPrintFn, setPreviewPrintFn] = useState<(() => void) | null>(null)
  const [printCount, setPrintCount] = useState(0)
  // Asked once, when someone heads for the ending without printing anything.
  const [confirmSkipPrint, setConfirmSkipPrint] = useState(false)

  const selected = event.scan_mode
  const totalCards = selected ? cardCounts[selected] : 0
  const printed = printCount > 0
  const ready = isEventReady(event, counts, groupType)
  const isDone = phase === 'done'
  // The ending celebrates the way the old final screen did: a burst and a
  // pulse as it appears, confetti for as long as it is on screen.
  const { celebrate, animationKey } = useStepEntryCelebration(isActive && isDone, true)

  const handlePrintReady = useCallback((print: (() => void) | null) => {
    setPrintFn(() => print)
  }, [])

  const handlePreviewPrintReady = useCallback((print: (() => void) | null) => {
    setPreviewPrintFn(() => print)
  }, [])

  const handlePrinted = useCallback(() => {
    setPrintCount((n) => n + 1)
  }, [])

  /**
   * Printing from inside the dialog hands the deck to the browser's print
   * window, which takes over the screen - coming back to a dialog still covering
   * the wizard reads as if nothing happened, so it closes behind the print.
   */
  const handlePreviewPrinted = useCallback(() => {
    setPrintCount((n) => n + 1)
    setPreviewOpen(false)
  }, [])

  const options: [SegmentedChoiceOption<ScanMode>, SegmentedChoiceOption<ScanMode>] = [
    {
      value: 'combined',
      label: 'סריקה בודדת',
      icon: QrCode,
      // One sentence per line - left to wrap on its own the break landed
      // mid-clause, in a different place in each half.
      description: (
        <>
          <span className="block">כרטיס מאוחד לכל שילוב של משתתף ומשימה.</span>
          <span className="block">סריקה אחת מזכה מיד בנקודות.</span>
        </>
      ),
      detail: <DeckDetail mode="combined" counts={cardCounts} loading={loading} />,
    },
    {
      value: 'split',
      label: 'סריקה כפולה',
      icon: ScanLine,
      description: (
        <>
          <span className="block">כרטיס נפרד לכל משתתף ולכל משימה.</span>
          <span className="block">סורקים משתתף ואז משימה.</span>
        </>
      ),
      detail: <DeckDetail mode="split" counts={cardCounts} loading={loading} />,
    },
  ]

  async function handleSelect(mode: ScanMode) {
    if (saving || selected === mode) return
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase
      .from('events')
      .update({ scan_mode: mode })
      .eq('id', event.id)

    setSaving(false)

    if (updateError) {
      setError('לא הצלחנו לשמור את הבחירה. נסו שוב.')
      return
    }

    onEventUpdated({ ...event, scan_mode: mode })
  }

  async function handleStart() {
    setStarting(true)
    if (event.status !== 'active') {
      await supabase.from('events').update({ status: 'active' }).eq('id', event.id)
    }
    trackWizardStepComplete(6, 'cards')

    // Resume activation if the user arrived via pricing without an event yet.
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
      {isActive && (
        <ReadyCelebrationOverlay celebrate={celebrate} burstKey={animationKey} confettiLoop={isDone} />
      )}

      <Modal
        isOpen={confirmSkipPrint}
        onClose={() => setConfirmSkipPrint(false)}
        title="רגע לפני שמתחילים"
      >
        <div className="space-y-4">
          <div className="space-y-2 text-sm text-muted">
            <p>עדיין לא הורדתם את כרטיסי המשחק.</p>
            <p>
              המשתתפים משחקים באמצעות הכרטיסים המודפסים, לכן מומלץ להוריד או להדפיס אותם
              לפני תחילת הפעילות.
            </p>
            <p>תוכלו להדפיס אותם גם בכל שלב בהמשך.</p>
          </div>

          <ModalActions className="pt-0">
            <Button
              dir="ltr"
              className="gap-1.5"
              onClick={() => {
                setConfirmSkipPrint(false)
                printFn?.()
              }}
              disabled={!printFn}
            >
              <Printer size={16} />
              הדפס כרטיסים
            </Button>
            <Button variant="outline" onClick={() => { setConfirmSkipPrint(false); setPhase('done') }}>
              המשך בכל זאת
            </Button>
          </ModalActions>
        </div>
      </Modal>

      <WizardStepWrapper
        title="מוכנים להתחיל?"
        // The ending speaks for itself inside the banner, so the page header
        // steps back to just the step name.
        subtitle={isDone
          ? undefined
          : 'לפני תחילת הפעילות, בחרו את סוג הכרטיסים, עברו עליהם במידת הצורך והדפיסו אותם.'}
        currentStep={6}
        // Six steps for a game: the template-only summary (7) is not part of
        // this run, so this is the last one and the CTA carries no arrow.
        totalSteps={6}
        canAdvance={isDone ? !starting : (!!selected && !saving)}
        // The footer button is the wizard's one forward action throughout, so
        // the ending takes it over rather than growing a second CTA of its own.
        // dir="ltr" on that button puts the icon to the left of the label.
        nextLabel={isDone ? (
          <span className="inline-flex items-center gap-2">
            <Rocket size={18} />
            התחל את הפעילות
          </span>
        ) : printed ? (
          <span className="inline-flex items-center gap-1.5">
            <Check size={16} strokeWidth={3} />
            הדפסתי את הכרטיסים
          </span>
        ) : 'המשך'}
        // Leaving this step without a printed deck is almost always a mistake,
        // so it gets a question rather than a silent pass.
        onNext={isDone ? handleStart : () => (printed ? setPhase('done') : setConfirmSkipPrint(true))}
        // Back out of the ending returns to the cards, not to the previous step.
        onBack={isDone ? () => setPhase('prepare') : onBack}
      >
        {/* The step takes the panel's own height, and nothing more, so what
            little it holds sits centred in it. It used to claim `100vh` minus
            the chrome instead, which only approximates the panel: the guess ran
            over, and every state scrolled inside a panel it did not come close
            to filling. Nothing here is tall now that the deck opens in a dialog
            of its own. */}
        <div className="flex min-h-0 flex-1 flex-col justify-center px-1">
          {error && <Alert variant="error" message={error} className="mb-3 shrink-0" />}

          {!ready ? (
            // Nothing to print and nothing to start - the game is still missing
            // something. This step says what, and gets out of the way.
            <ScrollContainer className="flex-1 space-y-3 px-0">
              <Alert variant="warning" className="text-xs">
                עוד לא הכול מוכן - השלימו את הפרטים החסרים ותוכלו להדפיס ולהתחיל.
              </Alert>
              <ReadinessChecklist
                checks={calculateReadiness(event, counts, groupType)}
                eventId={event.id}
                onGoToStep={onGoToStep}
              />
            </ScrollContainer>
          ) : (
            <AnimatePresence mode="wait">
              {!isDone ? (
                <motion.div
                  key="prepare"
                  className="flex min-h-0 flex-col"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <div className="shrink-0 p-1">
                    <WizardSegmentedChoice
                      ariaLabel="סוג הכרטיסים"
                      options={options}
                      value={selected}
                      onSelect={handleSelect}
                      dense
                      emphasizeDescription
                    />
                  </div>

                  {!selected && (
                    <p className="mt-3 text-center text-sm text-muted">
                      בחרו סוג כרטיסים כדי להדפיס ולהתחיל.
                    </p>
                  )}

                  {selected && (
                    <>
                      <div className="mt-3 flex shrink-0 flex-col gap-2 sm:flex-row">
                        {/* dir="ltr" only orders the box: the icon sits left of
                            the label, the Hebrew inside still reads right to
                            left. Same trick the wizard footer button uses. */}
                        <Button
                          size="lg"
                          dir="ltr"
                          onClick={() => printFn?.()}
                          disabled={!printFn}
                          className="flex-1 gap-2"
                        >
                          <Printer size={18} />
                          הדפסת כרטיסים
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          dir="ltr"
                          onClick={() => setPreviewOpen(true)}
                          disabled={totalCards === 0}
                          className="flex-1 gap-2"
                          aria-haspopup="dialog"
                        >
                          <Eye size={18} />
                          תצוגה מקדימה
                        </Button>
                      </div>

                      <p className="mt-2.5 flex shrink-0 items-center justify-center gap-1.5 text-center text-xs text-muted">
                        <Info size={14} className="shrink-0" />
                        אפשר להדפיס שוב כרטיסים בכל שלב במהלך הפעילות.
                      </p>

                      {/* The step's own copy of the deck, and the one its print
                          button uses. It draws nothing - `previewOpen` is left
                          false - and lays out a deck only when a print is asked
                          for, so the wizard page carries no cards. */}
                      <QrCardGenerator
                        event={event}
                        scanMode={selected}
                        onPrintReady={handlePrintReady}
                        onPrinted={handlePrinted}
                      />

                      {/* Looking the cards over is an aside, not a stage of the
                          wizard: the deck opened in the page pushed everything
                          around it and landed below the fold, so it now opens
                          in a dialog over the step and leaves it untouched. */}
                      <Modal
                        isOpen={previewOpen}
                        onClose={() => setPreviewOpen(false)}
                        title="תצוגה מקדימה של הכרטיסים"
                        subtitle="כך ייראו הכרטיסים שיודפסו."
                        // Nearly the whole screen: a deck read at postage-stamp
                        // size tells nobody whether it is worth printing.
                        dialogClassName="w-full max-w-[min(72rem,92vw)] h-[88dvh]"
                        footer={
                          <ModalActions className="pt-0">
                            <Button
                              dir="ltr"
                              className="gap-2"
                              onClick={() => (previewPrintFn ?? printFn)?.()}
                              disabled={!previewPrintFn && !printFn}
                            >
                              <Printer size={18} />
                              הדפסת כרטיסים
                            </Button>
                            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                              סגור
                            </Button>
                          </ModalActions>
                        }
                      >
                        <QrCardGenerator
                          event={event}
                          scanMode={selected}
                          previewOpen
                          onPrintReady={handlePreviewPrintReady}
                          onPrinted={handlePreviewPrinted}
                        />
                      </Modal>
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="done"
                  className="flex min-h-0 flex-col gap-3"
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                >
                  <ReadyCelebrationBanner
                    title="🎉 הכל מוכן!"
                    description="המשחק הוגדר בהצלחה. הכרטיסים מוכנים, ואפשר להתחיל את הפעילות."
                    celebrate={celebrate}
                    footerNote={selected === 'split'
                      ? 'הודפסו כרטיס לכל משתתף וכרטיס לכל פעילות - סורקים משתתף ואז פעילות.'
                      : 'לכל משתתף הודפס כרטיס אישי עם כל הפעילויות שהגדרתם.'}
                  >
                    <EventSummaryGrid
                      counts={counts}
                      ready
                      animationKey={animationKey}
                      showRewards
                      showCards
                      totalCards={totalCards}
                    />
                  </ReadyCelebrationBanner>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </WizardStepWrapper>
    </>
  )
}
