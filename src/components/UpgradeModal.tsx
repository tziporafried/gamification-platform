import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { usePlansModal } from '@/contexts/PlansModalContext'
import { trackCtaClick } from '@/lib/analytics'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
}

/** Shown when a paid-plan entity cap is hit (e.g. 70 participants). */
export function UpgradeModal({ isOpen, onClose, eventId }: UpgradeModalProps) {
  const { openPlans } = usePlansModal()

  function handleStart() {
    trackCtaClick({
      cta_name: 'view_activation_options',
      cta_location: 'plan_limit_modal',
      destination: 'plans_modal',
    })
    onClose()
    openPlans({ eventId, source: 'plan_limit_modal' })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="הגעתם למגבלת המשתתפים"
      titleClassName="text-xl font-bold text-foreground"
    >
      <div className="flex flex-col gap-6 pt-1 pb-1">
        <div className="space-y-3 text-center">
          <p className="text-[15px] text-foreground leading-[1.75]">
            באפשרות ההפעלה הנוכחית אפשר להוסיף עד 70 משתתפים.
          </p>
          <p className="text-sm text-muted leading-[1.75]">
            לצפייה באפשרויות הפעלה נוספות שמתאימות לאירוע שלכם.
          </p>
        </div>

        <Button variant="gradient" size="lg" className="w-full font-semibold tracking-wide" onClick={handleStart}>
          לצפייה באפשרויות
        </Button>
      </div>
    </Modal>
  )
}
