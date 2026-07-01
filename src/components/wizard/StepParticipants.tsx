import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Plus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { WizardStepWrapper } from './WizardStepWrapper'
import { InlineAddParticipant } from '@/components/participants/InlineAddParticipant'
import { UpgradeModal } from '@/components/UpgradeModal'
import { Button } from '@/components/ui/Button'
import { UsageBar } from '@/components/ui/UsageBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { ListRow } from '@/components/ui/ListRow'
import { DeleteButton } from '@/components/ui/IconButton'
import { InlineEditableText } from '@/components/ui/InlineEditableText'
import { ScrollContainer } from '@/components/ui/ScrollContainer'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { GroupSelectDropdown } from '@/components/groups/GroupSelectDropdown'
import { usePlanLimitsFromCounts } from '@/hooks/usePlanLimits'
import type { EventCounts, GroupType, Participant, ParticipantWithGroups, Group } from '@/types'

interface StepParticipantsProps {
  eventId: string
  counts: EventCounts
  groupType: GroupType | null
  isActive: boolean
  onCountsPatch: (patch: Partial<EventCounts>) => void
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

interface ParticipantGroupJoin {
  group_id: string
  groups: Group
}

export function StepParticipants({ eventId, counts, groupType, isActive, onCountsPatch, onCountsRefresh, onNext, onBack }: StepParticipantsProps) {
  const [participants, setParticipants] = useState<ParticipantWithGroups[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)
  const prevCountRef = useRef(0)
  const planLimits = usePlanLimitsFromCounts(counts, onCountsRefresh)

  const hasGroups = groupType === 'custom'

  const loadParticipants = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('participants')
      .select('*, participant_groups(group_id, groups(*))')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError('שגיאה בטעינת משתתפים.')
      return false
    }

    const mapped: ParticipantWithGroups[] = (data ?? []).map((p) => ({
      ...p,
      groups: ((p.participant_groups as unknown as ParticipantGroupJoin[]) ?? []).map((pg) => pg.groups),
    }))

    setParticipants(mapped)
    setError('')
    return true
  }, [eventId])

  useEffect(() => {
    let cancelled = false
    async function init() {
      const ok = await loadParticipants()
      if (!cancelled && ok) setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [loadParticipants])

  useEffect(() => {
    if (!isActive) return

    let cancelled = false
    async function fetchGroups() {
      if (!hasGroups) {
        setGroups([])
        return
      }

      const { data } = await supabase
        .from('groups')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

      if (!cancelled) setGroups((data as Group[]) ?? [])
    }

    fetchGroups()
    return () => { cancelled = true }
  }, [eventId, hasGroups, counts.groups, isActive])

  useEffect(() => {
    if (participants.length > prevCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
    prevCountRef.current = participants.length
  }, [participants.length])

  const handleAdded = useCallback((participant: Participant) => {
    setParticipants((prev) => {
      onCountsPatch({ participants: prev.length + 1 })
      return [...prev, { ...participant, groups: [] }]
    })
  }, [onCountsPatch])

  const handleDelete = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from('participants').delete().eq('id', id)
    if (deleteError) {
      setError('שגיאה במחיקת משתתף.')
      return
    }
    setParticipants((prev) => {
      onCountsPatch({ participants: Math.max(0, prev.length - 1) })
      return prev.filter((p) => p.id !== id)
    })
  }, [onCountsPatch])

  const handleToggleGroup = useCallback((participantId: string, groupId: string, isMember: boolean) => {
    setParticipants(prev => prev.map(p => {
      if (p.id !== participantId) return p
      const newGroups = isMember
        ? p.groups.filter(g => g.id !== groupId)
        : [...p.groups, groups.find(g => g.id === groupId)!]
      return { ...p, groups: newGroups }
    }))

    const mutation = isMember
      ? supabase.from('participant_groups').delete().eq('participant_id', participantId).eq('group_id', groupId)
      : supabase.from('participant_groups').insert({ participant_id: participantId, group_id: groupId })

    mutation.then(({ error: err }) => {
      if (err) {
        setError('שגיאה בעדכון קבוצה. הנתונים רועננו.')
        loadParticipants()
      }
    })
  }, [groups, loadParticipants])

  const handleSelectAllGroups = useCallback((participantId: string, currentGroupIds: Set<string>, allGroups: Group[]) => {
    const isAllSelected = allGroups.length > 0 && allGroups.every(g => currentGroupIds.has(g.id))
    const newGroups = isAllSelected ? [] : [...allGroups]

    setParticipants(prev => prev.map(p => {
      if (p.id !== participantId) return p
      return { ...p, groups: newGroups }
    }))

    const mutation = isAllSelected
      ? supabase.from('participant_groups').delete().eq('participant_id', participantId)
      : (() => {
          const missing = allGroups.filter(g => !currentGroupIds.has(g.id))
          return missing.length > 0
            ? supabase.from('participant_groups').insert(missing.map(g => ({ participant_id: participantId, group_id: g.id })))
            : Promise.resolve({ error: null })
        })()

    mutation.then(({ error: err }: { error: unknown }) => {
      if (err) {
        setError('שגיאה בעדכון קבוצות. הנתונים רועננו.')
        loadParticipants()
      }
    })
  }, [loadParticipants])

  if (loading) {
    return <CenteredLoader size="lg" />
  }

  return (
    <WizardStepWrapper
      title="מי משתתף?"
      subtitle="הוסיפו את כל המשתתפים בפעילות"
      currentStep={3}
      canAdvance={participants.length > 0}
      onNext={onNext}
      onBack={onBack}
    >
      <div className="flex h-full flex-col min-h-0">
        <div className="shrink-0 space-y-3 pb-3">
          {participants.length > 0 && (
            <p className="text-xs text-muted text-center">
              נוספו {participants.length} משתתפים
            </p>
          )}
          {planLimits.isFreePlan && planLimits.participants.limit !== null && (
            <UsageBar
              info={planLimits.participants}
              entity="participants"
              showCount={false}
            />
          )}
        </div>

        {error && (
          <div className="shrink-0 pb-2">
            <ErrorAlert message={error} />
          </div>
        )}

        {participants.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={<Users size={32} strokeWidth={1.75} />}
              title="אין משתתפים עדיין"
              description="הוסיפו את המשתתף הראשון"
              action={
                <Button size="sm" className="gap-1.5" onClick={() => addInputRef.current?.focus()}>
                  <Plus size={16} className="shrink-0" strokeWidth={2.5} />
                  הוסף משתתף
                </Button>
              }
            />
            <InlineAddParticipant
              eventId={eventId}
              onAdded={handleAdded}
              onPlanLimit={() => setUpgradeOpen(true)}
              placeholder="הקלידו שם משתתף ולחצו Enter"
              nameInputRef={addInputRef}
            />
          </div>
        ) : (
          <>
            <ScrollContainer ref={listRef} className="flex-1 space-y-2 pb-2">
              {participants.map((p) => (
                <MemoParticipantRow
                  key={p.id}
                  participant={p}
                  groups={hasGroups ? groups : []}
                  allGroups={groups}
                  onDelete={handleDelete}
                  onToggleGroup={handleToggleGroup}
                  onSelectAllGroups={handleSelectAllGroups}
                />
              ))}
            </ScrollContainer>

            <div className="shrink-0 pt-2">
              <InlineAddParticipant
                eventId={eventId}
                onAdded={handleAdded}
                onPlanLimit={() => setUpgradeOpen(true)}
                placeholder="הקלידו שם משתתף ולחצו Enter"
              />
            </div>
          </>
        )}
      </div>

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </WizardStepWrapper>
  )
}

interface ParticipantRowProps {
  participant: ParticipantWithGroups
  groups: Group[]
  allGroups: Group[]
  onDelete: (id: string) => void
  onToggleGroup: (participantId: string, groupId: string, isMember: boolean) => void
  onSelectAllGroups: (participantId: string, memberIds: Set<string>, allGroups: Group[]) => void
}

const MemoParticipantRow = memo(function ParticipantInlineRow({
  participant,
  groups,
  allGroups,
  onDelete,
  onToggleGroup,
  onSelectAllGroups,
}: ParticipantRowProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(participant.name)

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === participant.name) {
      setName(participant.name)
      setEditing(false)
      return
    }
    await supabase.from('participants').update({ name: trimmed }).eq('id', participant.id)
    setEditing(false)
  }

  const memberGroupIds = new Set(participant.groups.map(g => g.id))

  return (
    <ListRow>
      <div className="min-w-0 flex-1">
        <InlineEditableText
          value={name}
          onChange={setName}
          isEditing={editing}
          onStartEdit={() => setEditing(true)}
          onSave={saveName}
          onCancel={() => { setName(participant.name); setEditing(false) }}
        />
      </div>

      {groups.length > 0 && (
        <div className="shrink-0">
          <GroupSelectDropdown
            groups={groups}
            selectedGroupIds={memberGroupIds}
            allGroupsLabel="כל הקבוצות"
            tooltip="לאילו קבוצות שייך המשתתף"
            isAllSelected={false}
            onSelectAll={() => onSelectAllGroups(participant.id, memberGroupIds, allGroups)}
            onToggleGroup={(groupId, isMember) => onToggleGroup(participant.id, groupId, isMember)}
          />
        </div>
      )}

      <DeleteButton
        iconSize={14}
        revealOnHover
        onClick={() => onDelete(participant.id)}
      />
    </ListRow>
  )
})
