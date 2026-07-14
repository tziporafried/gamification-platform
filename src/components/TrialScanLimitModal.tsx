import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { trackCtaClick } from '@/lib/analytics'

interface TrialScanLimitModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
}

export function TrialScanLimitModal({ isOpen, onClose, eventId }: TrialScanLimitModalProps) {
  const navigate = useNavigate()

  function handleViewOptions() {
    trackCtaClick({
      cta_name: 'view_activation_options',
      cta_location: 'trial_scan_limit_modal',
      destination: '/plans',
    })
    onClose()
    navigate(`/plans?event=${eventId}&source=trial_scan_limit`)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="סיימתם את ההתנסות! 🎉"
      titleClassName="text-xl font-bold text-foreground"
    >
      <div className="flex flex-col gap-6 pt-1 pb-1">
        <div className="space-y-3 text-center">
          <p className="text-[15px] text-foreground leading-[1.75]">
            ראיתם איך הסריקות, הניקוד והתוצאות מתעדכנים בזמן אמת.
          </p>
          <p className="text-[15px] text-foreground leading-[1.75]">
            מוכנים להפוך את זה למשחק שלכם?
          </p>
          <p className="text-sm text-muted leading-[1.75]">
            בחרו את המסלול שמתאים לכם וסריקות הניסיון יאופסו.
          </p>
        </div>

        <Button variant="gradient" size="lg" className="w-full font-semibold tracking-wide" onClick={handleViewOptions}>
          להפעלת המשחק
        </Button>
      </div>
    </Modal>
  )
}
