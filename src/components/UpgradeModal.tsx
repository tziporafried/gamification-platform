import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const navigate = useNavigate()

  function handleStart() {
    onClose()
    navigate('/plans')
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="נהנים מהמשחק?"
      titleClassName="text-xl font-bold text-white"
    >
      <div className="flex flex-col gap-6 pt-1 pb-1">
        <div className="space-y-3 text-center">
          <p className="text-[15px] text-gray-200 leading-[1.75]">
            משחק ההתנסות נועד לתת לכם טעימה מהחוויה.
          </p>
          <p className="text-sm text-gray-400 leading-[1.75]">
            רוצים להפעיל את אותו המשחק בתוכנית שלכם?
            <br />
            נשמח לעזור לכם ליצור תוכנית בלתי נשכחת.
          </p>
        </div>

        <Button variant="gradient" size="lg" className="w-full font-semibold tracking-wide" onClick={handleStart}>
          בואו נתחיל
        </Button>
      </div>
    </Modal>
  )
}
