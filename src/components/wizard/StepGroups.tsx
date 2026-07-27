import { useState, useCallback, useEffect } from 'react'
import { Users, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { WizardSegmentedChoice, type SegmentedChoiceOption } from './WizardSegmentedChoice'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { GroupList } from '@/components/groups/GroupList'
import { WizardUsageScroll } from './WizardUsageScroll'
import type { GroupType, EventCounts, UserPlan } from '@/types'

interface StepGroupsProps {
  eventId: string
  plan: UserPlan
  groupType: GroupType | null
  counts: EventCounts
  isActive: boolean
  onGroupTypeSelect: (type: GroupType) => void
  onCountsPatch: (patch: Partial<EventCounts>) => void
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

const GROUP_OPTIONS: [SegmentedChoiceOption<GroupType>, SegmentedChoiceOption<GroupType>] = [
  { value: 'custom', label: 'תחרות בין קבוצות', description: 'המשתתפים יחולקו לקבוצות שיתחרו זו בזו לאורך המשחק.', icon: Layers },
  { value: 'none', label: 'תחרות בין משתתפים', description: 'כל משתתף יתחרה מול שאר המשתתפים ויצבור נקודות אישיות לאורך המשחק.', icon: Users },
]

interface CompetitionModeSelectorProps {
  groupType: GroupType | null
  onSelect: (type: GroupType) => void
  compact?: boolean
}

function CompetitionModeSelector({ groupType, onSelect, compact = false }: CompetitionModeSelectorProps) {
  return (
    <WizardSegmentedChoice
      ariaLabel="סוג התחרות"
      options={GROUP_OPTIONS}
      value={groupType}
      onSelect={onSelect}
      compact={compact}
    />
  )
}

export function StepGroups({
  eventId,
  groupType,
  counts,
  isActive,
  onGroupTypeSelect,
  onCountsPatch,
  onCountsRefresh,
  onNext,
  onBack,
}: StepGroupsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [localGroupCount, setLocalGroupCount] = useState(counts.groups)

  useEffect(() => {
    setLocalGroupCount(counts.groups)
  }, [counts.groups])

  const showGroupSetup = groupType === 'custom'
  const canAdvance = groupType === 'none' || localGroupCount > 0

  const handleCountChange = useCallback((count: number) => {
    setLocalGroupCount(count)
    onCountsPatch({ groups: count })
  }, [onCountsPatch])

  function handleOptionClick(type: GroupType) {
    if (groupType === type) return

    if (type === 'none' && localGroupCount > 0) {
      setConfirmDelete(true)
    } else {
      onGroupTypeSelect(type)
    }
  }

  async function handleConfirmDeleteGroups() {
    setDeleting(true)
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
    setLocalGroupCount(0)
    onCountsPatch({ groups: 0 })
    onCountsRefresh()
  }

  const compactGroupModeHeader = (
    <div className="shrink-0 px-1 pb-3">
      <CompetitionModeSelector
        groupType={groupType}
        onSelect={handleOptionClick}
        compact
      />
    </div>
  )

  return (
    <WizardStepWrapper
      title="איך תרצו לשחק?"
      subtitle="בחרו האם התחרות תהיה בין קבוצות או בין המשתתפים עצמם."
      currentStep={2}
      canAdvance={canAdvance}
      onNext={onNext}
      onBack={onBack}
    >
      <div className="relative flex h-full min-h-0 flex-col">
        <div
          className={cn(
            'flex h-full min-h-0 flex-col transition-opacity duration-150 ease-out',
            !showGroupSetup
              ? 'relative z-10 opacity-100'
              : 'pointer-events-none absolute inset-0 z-0 opacity-0',
          )}
        >
          <div className="shrink-0 p-1">
            <CompetitionModeSelector
              groupType={groupType}
              onSelect={handleOptionClick}
            />
          </div>

          <div
            className={cn(
              'flex min-h-[10rem] flex-1 flex-col items-center justify-center px-1 pt-2 transition-all duration-150 ease-out',
              groupType === 'none' ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            aria-hidden={groupType !== 'none'}
          >
            <EmptyState
              compact
              variant="solid"
              icon={<CheckCircle2 size={28} strokeWidth={1.75} className="text-success-text" />}
              title="מעולה!"
              description="כל משתתף יתחרה באופן עצמאי ואין צורך להגדיר קבוצות."
              className="w-full"
            />
          </div>
        </div>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col transition-opacity duration-150 ease-out',
            showGroupSetup
              ? 'relative z-10 opacity-100'
              : 'pointer-events-none absolute inset-0 z-0 opacity-0',
          )}
        >
          <WizardUsageScroll className="h-full min-h-0 flex-1">
            <GroupList
              key={groupType ?? 'unset'}
              embedded
              eventId={eventId}
              header={compactGroupModeHeader}
              isActive={isActive}
              onCountChange={handleCountChange}
              onImported={onCountsRefresh}
            />
          </WizardUsageScroll>
        </div>
      </div>

      <Modal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="מחיקת כל הקבוצות"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-surface-elevated border border-warning p-4">
            <AlertTriangle size={20} className="shrink-0 text-warning-text mt-0.5" />
            <div className="text-sm text-warning-foreground">
              <p className="font-medium mb-1">שים לב!</p>
              <p>מעבר ל"בלי קבוצות" ימחק את כל הקבוצות הקיימות ({localGroupCount}) ואת כל שיוכי המשתתפים לקבוצות.</p>
              <p className="mt-1">לא ניתן לבטל פעולה זו.</p>
            </div>
          </div>
          <ModalActions className="pt-0">
            <Button variant="danger" loading={deleting} className="bg-danger text-white hover:bg-danger hover:text-white" onClick={handleConfirmDeleteGroups}>
              אשר מחיקה
            </Button>
            <Button variant="outline" className="border-border text-foreground hover:bg-surface-elevated" onClick={() => setConfirmDelete(false)}>
              ביטול
            </Button>
          </ModalActions>
        </div>
      </Modal>
    </WizardStepWrapper>
  )
}
