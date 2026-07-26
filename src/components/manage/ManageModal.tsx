import { useState } from 'react'
import { Gift, ScanLine } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { ScansTab } from '@/components/manage/ScansTab'
import { RewardsTab } from '@/components/manage/RewardsTab'

/**
 * The event's management popup: the running game's data, as opposed to the
 * wizard's setup. Opens over the control center (and over the offline hub) so
 * the operator never loses the screen they were on.
 *
 * Tabs are local state - the popup is a detour, not a place to link into.
 */

interface ManageModalProps {
  eventId: string
  eventName?: string
  isOpen: boolean
  onClose: () => void
}

const TABS = [
  { id: 'scans', label: 'סריקות', icon: <ScanLine size={15} aria-hidden="true" /> },
  { id: 'rewards', label: 'פרסים', icon: <Gift size={15} aria-hidden="true" /> },
]

export function ManageModal({ eventId, eventName, isOpen, onClose }: ManageModalProps) {
  const [activeTab, setActiveTab] = useState(TABS[0].id)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={eventName ? `ניהול · ${eventName}` : 'ניהול'}
      // Big on a desktop, effectively full-screen on a phone: the scan log is a
      // long list and the point of the popup is seeing a lot of it at once.
      dialogClassName="max-w-4xl h-[85dvh]"
      contentClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-modal px-4 py-4 sm:px-6"
    >
      <Tabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="underline"
        className="mb-4"
      />

      {activeTab === 'scans' && <ScansTab eventId={eventId} />}
      {activeTab === 'rewards' && <RewardsTab eventId={eventId} />}
    </Modal>
  )
}
