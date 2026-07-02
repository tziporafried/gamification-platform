import { useState, useCallback } from 'react'
import { Users, Layers, AlertTriangle } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { GroupList } from '@/components/groups/GroupList'
import { WizardUsageScroll } from './WizardUsageScroll'
import type { GroupType, EventCounts, UserPlan } from '@/types'

interface StepGroupsProps {
  eventId: string
  plan: UserPlan
  groupType: GroupType | null
  counts: EventCounts
  onGroupTypeSelect: (type: GroupType) => void
  onCountsPatch: (patch: Partial<EventCounts>) => void
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

const GROUP_OPTIONS: { type: GroupType; label: string; description: string; icon: typeof Users }[] = [
  { type: 'none', label: 'כולם יחד', description: 'כל המשתתפים צוברים נקודות באותה טבלה', icon: Users },
  { type: 'custom', label: 'משפחות וקבוצות', description: 'חלקו את המשתתפים למשפחות, צוותים או קבוצות תחרות', icon: Layers },
]

const GROUP_OPTION_STYLES: Record<GroupType, { card: string; cardSelected: string; iconSelected: string }> = {
  none: {
    card: 'bg-[color-mix(in_srgb,var(--color-secondary)_22%,var(--color-surface))]',
    cardSelected:
      'bg-[color-mix(in_srgb,var(--color-secondary)_32%,var(--color-surface))] ring-2 ring-secondary border-secondary',
    iconSelected: 'text-secondary',
  },
  custom: {
    card: 'bg-[color-mix(in_srgb,var(--color-tertiary)_22%,var(--color-surface))]',
    cardSelected:
      'bg-[color-mix(in_srgb,var(--color-tertiary)_32%,var(--color-surface))] ring-2 ring-tertiary border-tertiary',
    iconSelected: 'text-tertiary',
  },
}

export function StepGroups({
  eventId,
  groupType,
  counts,
  onGroupTypeSelect,
  onCountsPatch,
  onNext,
  onBack,
}: StepGroupsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [localGroupCount, setLocalGroupCount] = useState(counts.groups)

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
  }

  function renderGroupOptions(compact: boolean) {
    return GROUP_OPTIONS.map(({ type, label, description, icon: Icon }) => {
      const optionStyles = GROUP_OPTION_STYLES[type]
      const isSelected = groupType === type

      return (
        <button
          key={type}
          type="button"
          onClick={() => handleOptionClick(type)}
          className={cn('w-full text-right', !compact && 'h-full')}
        >
          <div
            className={cn(
              'rounded-xl border shadow-none',
              'flex h-full w-full cursor-pointer transition-all duration-200 justify-center',
              compact
                ? cn(
                    'min-h-0 py-1.5 px-2.5 flex-row items-center gap-1.5 text-right rounded-lg',
                    isSelected
                      ? cn(
                          'ring-1 shadow-sm font-semibold',
                          'bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-surface))] ring-primary border-primary',
                        )
                      : cn(
                          'bg-surface opacity-75',
                          theme.borderInteractive,
                        ),
                  )
                : cn(
                    'p-6 flex-col items-center gap-3 text-center',
                    'hover:shadow-card-hover hover:-translate-y-0.5',
                    optionStyles.card,
                    isSelected
                      ? optionStyles.cardSelected
                      : theme.borderInteractive,
                  ),
            )}
          >
            <Icon
              size={compact ? 16 : 32}
              className={cn(
                'shrink-0 transition-colors',
                compact
                  ? isSelected ? 'text-primary' : 'text-muted'
                  : isSelected ? optionStyles.iconSelected : 'text-muted',
              )}
            />
            <div className={cn(!compact && 'flex flex-1 flex-col items-center')}>
              <span className={cn(
                'font-medium',
                compact
                  ? isSelected
                    ? 'font-semibold text-primary'
                    : 'font-medium text-muted'
                  : 'text-foreground',
                compact ? 'text-xs' : 'text-base',
              )}>
                {label}
              </span>
              {!compact && (
                <span className="mt-1 block min-h-[2.75rem] text-xs text-muted">{description}</span>
              )}
            </div>
          </div>
        </button>
      )
    })
  }

  const compactGroupModeHeader = (
    <div className="shrink-0 px-1 pb-3">
      <div className="grid grid-cols-2 gap-4 px-1">
        {renderGroupOptions(true)}
      </div>
    </div>
  )

  return (
    <WizardStepWrapper
      title="איך תרצו לשחק?"
      subtitle="אפשר לשחק יחד או לחלק את המשתתפים לקבוצות ומשפחות"
      currentStep={2}
      canAdvance={canAdvance}
      onNext={onNext}
      onBack={onBack}
    >
      <div className="flex h-full flex-col min-h-0">
        {!showGroupSetup && (
          <div className="shrink-0 space-y-4">
            <div className="grid grid-cols-2 items-stretch gap-3 p-1">
              {renderGroupOptions(false)}
            </div>
          </div>
        )}

        {showGroupSetup && (
          <div className="flex min-h-0 flex-1 flex-col">
            <WizardUsageScroll className="h-full min-h-0 flex-1">
              <GroupList
                embedded
                eventId={eventId}
                header={compactGroupModeHeader}
                onCountChange={handleCountChange}
              />
            </WizardUsageScroll>
          </div>
        )}
      </div>

      <Modal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="מחיקת כל הקבוצות"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-surface-elevated border border-warning p-4">
            <AlertTriangle size={20} className="shrink-0 text-warning mt-0.5" />
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
