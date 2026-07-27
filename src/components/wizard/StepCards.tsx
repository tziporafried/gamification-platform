import { useState } from 'react'
import { QrCode, ScanLine, Printer, Check } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ScrollContainer } from '@/components/ui/ScrollContainer'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useCardCounts } from '@/hooks/useCardCounts'
import type { Event, ScanMode } from '@/types'

interface StepCardsProps {
  event: Event
  isActive: boolean
  /** The saved choice goes back to the wizard, which owns the event row. */
  onEventUpdated: (event: Event) => void
  onNext: () => void
  onBack: () => void
}

const OPTIONS: {
  mode: ScanMode
  icon: typeof QrCode
  title: string
  description: string
  scannerNote: string
}[] = [
  {
    mode: 'combined',
    icon: QrCode,
    title: 'סריקה בודדת',
    description: 'כרטיס מאוחד לכל שילוב של משתתף ומשימה.',
    scannerNote: 'בפעילות: סריקה אחת מזכה מיד בנקודות.',
  },
  {
    mode: 'split',
    icon: ScanLine,
    title: 'סריקה כפולה',
    description: 'כרטיס נפרד לכל משתתף ולכל משימה.',
    scannerNote: 'בפעילות: סורקים שני כרטיסים - הנקודות נזקפות אחרי השני.',
  },
]

/**
 * Step 6 - which deck of cards the game runs on.
 *
 * This used to be a modal in front of the print button on the last step, which
 * meant an operator could reach the end of the wizard without ever learning
 * that cards have to be printed and handed out at all. It is a step of its own
 * so the question is asked out loud, and the answer is written to the event
 * (077) rather than kept in component state - the next step lays the deck out
 * from it, and it survives leaving the page.
 */
export function StepCards({ event, isActive, onEventUpdated, onNext, onBack }: StepCardsProps) {
  const { cardCounts, loading } = useCardCounts(event.id, isActive)
  const [savingMode, setSavingMode] = useState<ScanMode | null>(null)
  const [error, setError] = useState('')

  const selected = event.scan_mode

  async function handleSelect(mode: ScanMode) {
    if (savingMode || selected === mode) return
    setSavingMode(mode)
    setError('')

    const { error: updateError } = await supabase
      .from('events')
      .update({ scan_mode: mode })
      .eq('id', event.id)

    setSavingMode(null)

    if (updateError) {
      setError('לא הצלחנו לשמור את הבחירה. נסו שוב.')
      return
    }

    onEventUpdated({ ...event, scan_mode: mode })
  }

  return (
    <WizardStepWrapper
      title="איזה כרטיסים תדפיסו?"
      subtitle="המשחק רץ על כרטיסים מודפסים - המשתתפים סורקים אותם כדי לצבור נקודות. בחרו את סוג הכרטיס, ובשלב הבא אפשר יהיה להדפיס."
      currentStep={6}
      canAdvance={!!selected && !savingMode}
      nextLabel="המשך להדפסה"
      onNext={onNext}
      onBack={onBack}
    >
      <ScrollContainer className="min-h-0 flex-1">
        {error && (
          <p className="mb-3 rounded-lg border border-danger bg-surface-elevated px-3 py-2 text-sm text-danger-text">
            {error}
          </p>
        )}

        <div role="radiogroup" aria-label="סוג הכרטיסים" className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map(({ mode, icon: Icon, title, description, scannerNote }) => {
            const isSelected = selected === mode
            const isSaving = savingMode === mode

            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleSelect(mode)}
                className={cn(
                  'relative flex flex-col items-center rounded-2xl border p-5 text-center transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-surface hover:bg-surface-elevated',
                )}
              >
                <span
                  className={cn(
                    'absolute start-3 top-3 flex h-6 w-6 items-center justify-center rounded-full transition-opacity',
                    isSelected || isSaving ? 'bg-primary opacity-100' : 'opacity-0',
                  )}
                  aria-hidden="true"
                >
                  {isSaving ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-on-primary)] border-t-transparent motion-reduce:animate-none" />
                  ) : (
                    <Check size={14} strokeWidth={3} className="text-[var(--color-on-primary)]" />
                  )}
                </span>

                <Icon
                  size={40}
                  strokeWidth={1.6}
                  className={cn('shrink-0', isSelected ? 'text-primary-text' : 'text-muted/70')}
                />

                <span className="mt-3 text-base font-bold text-foreground">{title}</span>

                <span className="mt-2 text-xs font-semibold text-foreground">
                  {loading ? '—' : `${cardCounts[mode].toLocaleString('he-IL')} כרטיסים להדפסה`}
                </span>

                <span className="mt-2 block text-xs leading-relaxed text-muted">{description}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">{scannerNote}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface-elevated p-4">
          <Printer size={18} className="mt-0.5 shrink-0 text-muted" />
          <div className="text-xs leading-relaxed text-muted">
            <p className="font-semibold text-foreground">אל תשכחו להדפיס</p>
            <p className="mt-1">
              בלי כרטיסים מודפסים אין מה לסרוק. בשלב הבא תוכלו לראות את הכרטיסים ולהדפיס אותם -
              ואפשר להדפיס שוב בכל שלב במהלך הפעילות.
            </p>
            <p className="mt-1">
              הסורק קורא ממילא את שני סוגי הכרטיסים, אז אפשר לחזור לכאן ולשנות -
              וכרטיסים שכבר הודפסו ימשיכו לעבוד.
            </p>
          </div>
        </div>
      </ScrollContainer>
    </WizardStepWrapper>
  )
}
