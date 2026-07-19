import { useEffect, useState } from 'react'
import { QrCode, ScanLine } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { CardCounts } from '@/components/qr-cards/QrCardGenerator'
import type { ScanMode } from '@/types'

interface ScanModeModalProps {
  isOpen: boolean
  /** The mode currently in effect — preselected when the modal opens. */
  value: ScanMode
  /** Real deck sizes from QrCardGenerator, so these match what actually prints. */
  cardCounts: CardCounts
  onCancel: () => void
  /** Confirmed choice — the caller applies it and then reveals the cards. */
  onConfirm: (mode: ScanMode) => void
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
    scannerNote: 'בפעילות: סורקים שני כרטיסים — הנקודות נזקפות אחרי השני.',
  },
]

/**
 * Gate in front of card generation: which deck to print is decided once, right
 * before the cards are laid out. The scanner reads either deck, so this choice
 * never leaves the print flow.
 */
export function ScanModeModal({
  isOpen,
  value,
  cardCounts,
  onCancel,
  onConfirm,
}: ScanModeModalProps) {
  const [selected, setSelected] = useState<ScanMode>(value)

  // Reopening after a cancel should show what is in effect, not the last thing
  // that was clicked and abandoned.
  useEffect(() => {
    if (isOpen) setSelected(value)
  }, [isOpen, value])

  const cardCount = (mode: ScanMode) => cardCounts[mode]

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="איך יעבוד הסורק בפעילות?" dialogClassName="max-w-lg">
      <div className="space-y-4">
        <div role="radiogroup" aria-label="אופן הסריקה" className="space-y-2">
          {OPTIONS.map(({ mode, icon: Icon, title, description, scannerNote }) => {
            const isSelected = selected === mode
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(mode)}
                className={cn(
                  'w-full rounded-xl border p-3.5 text-right transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-surface hover:bg-surface-elevated',
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon size={17} className={isSelected ? 'text-primary-text' : 'text-muted'} />
                  <span className="text-sm font-semibold text-foreground">{title}</span>
                  <span className="mr-auto text-xs font-semibold text-foreground">
                    {cardCount(mode).toLocaleString('he-IL')} כרטיסים
                  </span>
                </span>
                <span className="mt-1.5 block text-xs leading-relaxed text-muted">{description}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{scannerNote}</span>
              </button>
            )
          })}
        </div>

        <p className="text-xs text-muted">
          הסורק קורא ממילא את שני סוגי הכרטיסים, אז אפשר לשנות בהמשך ולהדפיס מחדש —
          וכרטיסים שכבר הודפסו ימשיכו לעבוד.
        </p>

        <ModalActions>
          <Button onClick={() => onConfirm(selected)}>
            המשך לכרטיסים
          </Button>
          <Button variant="outline" onClick={onCancel}>
            ביטול
          </Button>
        </ModalActions>
      </div>
    </Modal>
  )
}
