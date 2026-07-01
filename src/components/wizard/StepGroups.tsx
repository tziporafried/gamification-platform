import { useState, useCallback } from 'react'
import { Users, Layers, AlertTriangle } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { UsageBar } from '@/components/ui/UsageBar'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { usePlanLimitsFromCounts } from '@/hooks/usePlanLimits'
import { GroupList } from '@/components/groups/GroupList'
import type { GroupType, EventCounts } from '@/types'

interface StepGroupsProps {
  eventId: string
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

const GROUP_OPTION_STYLES: Record<GroupType, { card: string; cardSelected: string }> = {
  none: {
    card: 'bg-[color-mix(in_srgb,var(--color-secondary)_22%,var(--color-surface))]',
    cardSelected:
      'bg-[color-mix(in_srgb,var(--color-secondary)_32%,var(--color-surface))] ring-2 ring-secondary border-secondary',
  },
  custom: {
    card: 'bg-[color-mix(in_srgb,var(--color-tertiary)_22%,var(--color-surface))]',
    cardSelected:
      'bg-[color-mix(in_srgb,var(--color-tertiary)_32%,var(--color-surface))] ring-2 ring-tertiary border-tertiary',
  },
}

export function StepGroups({
  eventId,
  groupType,
  counts,
  onGroupTypeSelect,
  onCountsPatch,
  onCountsRefresh,
  onNext,
  onBack,
}: StepGroupsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [localGroupCount, setLocalGroupCount] = useState(counts.groups)
  const planLimits = usePlanLimitsFromCounts(counts, onCountsRefresh)

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
        <div className="shrink-0 space-y-4">
          <div className="grid grid-cols-2 items-stretch gap-3 p-1">
            {GROUP_OPTIONS.map(({ type, label, description, icon: Icon }) => {
              const optionStyles = GROUP_OPTION_STYLES[type]
              const isSelected = groupType === type

              return (
              <button
                key={type}
                onClick={() => handleOptionClick(type)}
                className="h-full w-full text-right"
              >
                <Card
                  variant="default"
                  className={cn(
                    'flex h-full w-full cursor-pointer transition-all duration-200 justify-center',
                    'hover:shadow-card-hover hover:-translate-y-0.5',
                    optionStyles.card,
                    showGroupSetup
                      ? 'p-3 flex-row items-center gap-2 text-right'
                      : 'p-6 flex-col items-center gap-3 text-center',
                    isSelected
                      ? cn(
                          optionStyles.cardSelected,
                          type === 'none' ? 'hover:border-secondary' : 'hover:border-tertiary',
                        )
                      : 'border-transparent hover:border-transparent',
                  )}
                >
                  <Icon
                    size={showGroupSetup ? 20 : 32}
                    className={cn(
                      'shrink-0 transition-colors',
                      isSelected ? 'text-primary' : 'text-muted',
                    )}
                  />
                  <div className={cn(!showGroupSetup && 'flex flex-1 flex-col items-center')}>
                    <span className={cn(
                      'font-medium text-foreground',
                      showGroupSetup ? 'text-sm' : 'text-base',
                    )}>
                      {label}
                    </span>
                    {!showGroupSetup && (
                      <span className="mt-1 block min-h-[2.75rem] text-xs text-muted">{description}</span>
                    )}
                  </div>
                </Card>
              </button>
            )})}
          </div>

          {showGroupSetup && localGroupCount > 0 && (
            <p className="text-xs text-muted text-center">{localGroupCount} קבוצות</p>
          )}

          {showGroupSetup && planLimits.isFreePlan && (
            <UsageBar info={planLimits.groups} entity="groups" />
          )}
        </div>

        {showGroupSetup && (
          <div className="flex min-h-0 flex-1 flex-col mt-4">
            <GroupList eventId={eventId} onCountChange={handleCountChange} />
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
          <div className="flex gap-3">
            <Button variant="danger" loading={deleting} className="bg-danger text-foreground hover:bg-danger" onClick={handleConfirmDeleteGroups}>
              מחק הכל ועבור לבלי קבוצות
            </Button>
            <Button variant="outline" className="border-border text-foreground hover:bg-surface-elevated" onClick={() => setConfirmDelete(false)}>
              ביטול
            </Button>
          </div>
        </div>
      </Modal>
    </WizardStepWrapper>
  )
}
