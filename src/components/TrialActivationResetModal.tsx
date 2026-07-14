import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface TrialActivationResetModalProps {
  isOpen: boolean
  onClose: () => void
  onContinue: () => void
  /** When true, primary CTA is pending (e.g. admin RPC in flight). */
  loading?: boolean
}

/** Explains that trial runtime data will be cleared before real activation. */
export function TrialActivationResetModal({
  isOpen,
  onClose,
  onContinue,
  loading = false,
}: TrialActivationResetModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => undefined : onClose}
      title="המשחק מוכן לאירוע 🎉"
      titleClassName="text-xl font-bold text-foreground"
    >
      <div className="flex flex-col gap-6 pt-1 pb-1">
        <div className="space-y-3 text-center">
          <p className="text-[15px] text-foreground leading-[1.75]">
            לפני שמתחילים, נתוני ההתנסות יאופסו כדי שהמשחק יתחיל עם תוצאות נקיות.
          </p>
          <p className="text-sm text-muted leading-[1.75]">
            הקבוצות, המשתתפים והגדרות המשחק יישארו ללא שינוי.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="gradient"
            size="lg"
            className="w-full font-semibold tracking-wide"
            onClick={onContinue}
            disabled={loading}
          >
            המשך להפעלת המשחק
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose} disabled={loading}>
            ביטול
          </Button>
        </div>
      </div>
    </Modal>
  )
}
