import { useState } from 'react'
import { Users, Layers, AlertTriangle } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { UsageBar } from '@/components/ui/UsageBar'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { GroupList } from '@/components/groups/GroupList'
import type { GroupType, EventCounts } from '@/types'

interface StepGroupsProps {
  eventId: string
  groupType: GroupType | null
  counts: EventCounts
  onGroupTypeSelect: (type: GroupType) => void
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

const GROUP_OPTIONS: { type: GroupType; label: string; description: string; icon: typeof Users }[] = [
  { type: 'none', label: 'בלי קבוצות', description: 'כולם משחקים ביחד, בלי חלוקה', icon: Users },
  { type: 'custom', label: 'כן, חלק לקבוצות', description: 'משפחות, צוותים, או כל חלוקה שתרצה', icon: Layers },
]

export function StepGroups({
  eventId,
  groupType,
  counts,
  onGroupTypeSelect,
  onCountsRefresh,
  onNext,
  onBack,
}: StepGroupsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const planLimits = usePlanLimits(eventId)

  const showGroupSetup = groupType === 'custom'
  const canAdvance = groupType === 'none' || counts.groups > 0

  function handleOptionClick(type: GroupType) {
    if (type === 'none' && counts.groups > 0) {
      setConfirmDelete(true)
    } else {
      onGroupTypeSelect(type)
    }
  }

  async function handleConfirmDeleteGroups() {
    setDeleting(true)
    // Delete all participant_groups first, then groups
    const { data: groups } = await supabase
      .from('groups')
      .select('id')
      .eq('event_id', eventId)

    if (groups && groups.length > 0) {
      const groupIds = groups.map(g => g.id)
      await supabase.from('participant_groups').delete().in('group_id', groupIds)
      await supabase.from('groups').delete().eq('event_id', eventId)
    }

    setDeleting(false)
    setConfirmDelete(false)
    onGroupTypeSelect('none')
    onCountsRefresh()
  }

  return (
    <WizardStepWrapper
      title="קבוצות"
      subtitle="רוצה לחלק את המשתתפים לקבוצות?"
      currentStep={2}
      canAdvance={canAdvance}
      onNext={onNext}
      onBack={onBack}
    >
      {/* Two simple options */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GROUP_OPTIONS.map(({ type, label, description, icon: Icon }) => (
          <button
            key={type}
            onClick={() => handleOptionClick(type)}
            className="text-right w-full"
          >
            <Card
              variant="interactive"
              className={cn(
                'p-6 flex flex-col items-center gap-3 text-center cursor-pointer transition-all min-h-[120px] justify-center',
                groupType === type && 'ring-2 ring-brand-500 border-brand-500/50',
              )}
            >
              <Icon
                size={32}
                className={cn(
                  'transition-colors',
                  groupType === type ? 'text-brand-400' : 'text-gray-500',
                )}
              />
              <span className={cn(
                'text-base font-medium',
                groupType === type ? 'text-white' : 'text-gray-300',
              )}>
                {label}
              </span>
              <span className="text-xs text-gray-500">{description}</span>
            </Card>
          </button>
        ))}
      </div>

      {/* Group management (when "Yes" is selected) */}
      {showGroupSetup && (
        <div className="mt-8 space-y-4">
          {planLimits.isFreePlan && (
            <UsageBar info={planLimits.groups} entity="groups" />
          )}
          <GroupList eventId={eventId} onCountChange={onCountsRefresh} />
        </div>
      )}

      {/* Confirmation modal for deleting all groups */}
      <Modal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="מחיקת כל הקבוצות"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
            <AlertTriangle size={20} className="shrink-0 text-amber-400 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-medium mb-1">שים לב!</p>
              <p>מעבר ל"בלי קבוצות" ימחק את כל הקבוצות הקיימות ({counts.groups}) ואת כל שיוכי המשתתפים לקבוצות.</p>
              <p className="mt-1">לא ניתן לבטל פעולה זו.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="danger" loading={deleting} onClick={handleConfirmDeleteGroups}>
              מחק הכל ועבור לבלי קבוצות
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              ביטול
            </Button>
          </div>
        </div>
      </Modal>
    </WizardStepWrapper>
  )
}
