import { useState, useCallback } from 'react'
import { Users, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
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
  onGroupTypeSelect: (type: GroupType) => void
  onCountsPatch: (patch: Partial<EventCounts>) => void
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

const GROUP_OPTIONS: { type: GroupType; label: string; description: string; icon: typeof Users }[] = [
  { type: 'custom', label: 'תחרות בין קבוצות', description: 'המשתתפים יחולקו לקבוצות שיתחרו זו בזו לאורך המשחק.', icon: Layers },
  { type: 'none', label: 'תחרות בין משתתפים', description: 'כל משתתף יתחרה מול שאר המשתתפים ויצבור נקודות אישיות לאורך המשחק.', icon: Users },
]

const SELECTED_SEGMENT_STYLES = {
  indicator:
    'bg-[color-mix(in_srgb,var(--color-tertiary)_11%,var(--color-surface))]',
  icon: 'text-tertiary',
  title: 'text-[color-mix(in_srgb,var(--color-tertiary)_88%,var(--color-foreground))]',
  description: 'text-muted/58',
} as const

interface CompetitionModeSelectorProps {
  groupType: GroupType | null
  onSelect: (type: GroupType) => void
  compact?: boolean
}

function CompetitionModeSelector({ groupType, onSelect, compact = false }: CompetitionModeSelectorProps) {
  const hasSelection = groupType !== null

  return (
    <div
      role="radiogroup"
      aria-label="סוג התחרות"
      className={cn(
        'relative grid grid-cols-2 items-stretch gap-0 border border-border bg-surface-elevated p-1',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.06)]',
        'transition-[box-shadow,border-color] duration-200 ease-out',
        compact ? 'rounded-xl' : 'rounded-2xl',
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-4 bottom-4 start-1/2 z-20 w-px -translate-x-1/2 bg-border/70"
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute rounded-xl',
          SELECTED_SEGMENT_STYLES.indicator,
          'transition-[inset-inline-start,inset-inline-end,opacity,background-color] duration-200 ease-out',
          compact ? 'top-1.5 bottom-1.5' : 'top-2 bottom-2',
          !hasSelection && 'opacity-0',
          groupType === 'custom' && 'start-1.5 end-[calc(50%+1px)]',
          groupType === 'none' && 'start-[calc(50%+1px)] end-1.5',
        )}
      />

      {GROUP_OPTIONS.map(({ type, label, description, icon: Icon }) => {
        const isSelected = groupType === type

        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(type)}
            className={cn(
              'group/segment relative z-10 flex h-full w-full min-w-0 cursor-pointer items-center justify-center text-center',
              'rounded-xl transition-[color,background-color] duration-200 ease-out',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-tertiary/35 focus-visible:ring-offset-0',
              compact
                ? 'min-h-[2.375rem] flex-row gap-2.5 px-4 py-2.5'
                : 'min-h-[9.5rem] flex-col gap-6 px-7 py-7',
              isSelected
                ? SELECTED_SEGMENT_STYLES.title
                : cn(
                    'text-foreground/85',
                    'hover:bg-[color-mix(in_srgb,var(--color-foreground)_3%,var(--color-surface))]',
                  ),
            )}
          >
            <span
              className={cn(
                'inline-flex shrink-0 items-center justify-center transition-colors duration-200 ease-out',
                compact ? 'h-6 w-6' : 'h-[3.25rem] w-[3.25rem]',
              )}
            >
              <Icon
                size={compact ? 25 : 52}
                strokeWidth={compact ? 2 : 1.55}
                className={cn(
                  'shrink-0 transition-colors duration-200 ease-out',
                  isSelected ? SELECTED_SEGMENT_STYLES.icon : 'text-muted/68',
                )}
              />
            </span>
            <div
              className={cn(
                'flex min-w-0 flex-col items-center',
                !compact && 'max-w-[11.5rem]',
              )}
            >
              <span
                className={cn(
                  'block transition-colors duration-200 ease-out',
                  compact
                    ? cn('text-xs leading-tight', isSelected ? 'font-bold' : 'font-semibold')
                    : cn('text-base leading-snug', isSelected ? 'font-bold' : 'font-semibold'),
                )}
              >
                {label}
              </span>
              {!compact && (
                <span
                  className={cn(
                    'mt-3 block min-h-[2.75rem] text-[11px] leading-relaxed transition-colors duration-200 ease-out',
                    isSelected
                      ? cn(SELECTED_SEGMENT_STYLES.description, 'font-normal')
                      : 'font-normal text-muted/62',
                  )}
                >
                  {description}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
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
              icon={<CheckCircle2 size={28} strokeWidth={1.75} className="text-success" />}
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
              embedded
              eventId={eventId}
              header={compactGroupModeHeader}
              onCountChange={handleCountChange}
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
