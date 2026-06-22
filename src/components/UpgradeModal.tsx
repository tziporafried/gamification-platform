import { Modal } from '@/components/ui/Modal'
import { FREE_PLAN_LIMITS, ENTITY_LABELS, UPGRADE_CONTACT_EMAIL, type LimitableEntity } from '@/lib/plans'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}


const LIMIT_ENTRIES = (Object.keys(FREE_PLAN_LIMITS) as LimitableEntity[]).map(entity => ({
  entity,
  label: ENTITY_LABELS[entity],
  limit: FREE_PLAN_LIMITS[entity],
}))

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="הגעת למגבלת המסלול החינמי">
      <div className="space-y-5">
        <p className="text-sm text-gray-400">
          המסלול החינמי מוגבל ל:
        </p>

        <div className="space-y-2">
          {LIMIT_ENTRIES.map(({ entity, label, limit }) => (
            <div key={entity} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-sm text-gray-300">{label}</span>
              <span className="text-sm font-medium text-gray-400">עד {limit}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 text-center space-y-2">
          <p className="text-sm font-medium text-white">צריך יותר?</p>
          <a
            href={`mailto:${UPGRADE_CONTACT_EMAIL}?subject=שדרוג מסלול`}
            className="inline-block text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors"
          >
            צור קשר לשדרוג
          </a>
        </div>
      </div>
    </Modal>
  )
}
