import { useState } from 'react'
import { Gift, PartyPopper, ScanLine } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { ScansTab } from '@/components/manage/ScansTab'
import { RewardsTab } from '@/components/manage/RewardsTab'
import { LotteryTab } from '@/components/manage/LotteryTab'

/**
 * The event's management popup: the running game's data, as opposed to the
 * wizard's setup. Opens over the control center (and over the offline hub) so
 * the operator never loses the screen they were on.
 *
 * Tabs are local state - the popup is a detour, not a place to link into.
 *
 * A game with `advanced_management` never opens this: its "ניהול" button goes
 * to the full screen instead. Two doors labelled the same thing, one of them a
 * link inside the other, is a worse answer than one door that leads to what
 * the game actually has. The popup stays because it is still the whole of
 * management for every other game, and because it is the only version an
 * exported offline file can run - there is no route inside that file.
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
  { id: 'lottery', label: 'הגרלות', icon: <PartyPopper size={15} aria-hidden="true" /> },
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
      {activeTab === 'lottery' && <LotteryTab eventId={eventId} />}
    </Modal>
  )
}
