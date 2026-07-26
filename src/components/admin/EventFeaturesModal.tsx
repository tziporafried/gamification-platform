import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ModalActions } from '@/components/ui/ModalActions'
import { EventFeaturesPanel } from '@/components/admin/EventFeaturesPanel'
import { PLAN_BADGE_COLORS } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { PLAN_LABELS } from '@/lib/eventPlanLabels'
import type { UserPlan } from '@/types'

interface EventFeaturesModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  eventName: string
  plan: UserPlan
  onChanged?: () => void
}

/** The flags panel on its own, for screens that manage a game in a dialog. */
export function EventFeaturesModal({
  isOpen,
  onClose,
  eventId,
  eventName,
  plan,
  onChanged,
}: EventFeaturesModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="פיצ׳ר פלאגים של המשחק" dialogClassName="max-w-lg">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{eventName}</span>
          <Badge
            label={PLAN_LABELS[plan] ?? plan}
            color={PLAN_BADGE_COLORS[plan] ?? 'var(--color-muted)'}
          />
        </div>

        {isOpen && <EventFeaturesPanel eventId={eventId} plan={plan} onChanged={onChanged} />}

        <ModalActions>
          <Button type="button" variant="outline" onClick={onClose}>
            סגור
          </Button>
        </ModalActions>
      </div>
    </Modal>
  )
}
