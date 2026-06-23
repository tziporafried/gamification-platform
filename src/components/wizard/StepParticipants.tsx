import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { WizardStepWrapper } from './WizardStepWrapper'
import { InlineAddParticipant } from '@/components/participants/InlineAddParticipant'
import { UpgradeModal } from '@/components/UpgradeModal'
import { UsageBar } from '@/components/ui/UsageBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { GroupSelectDropdown } from '@/components/groups/GroupSelectDropdown'
import { usePlanLimitsFromCounts } from '@/hooks/usePlanLimits'
import type { EventCounts, GroupType, ParticipantWithGroups, Group } from '@/types'

interface StepParticipantsProps {
  eventId: string
  counts: EventCounts
  groupType: GroupType | null
  onCountsRefresh: () => void
  onNext: () => void
  onBack: () => void
}

interface ParticipantGroupJoin {
  group_id: string
  groups: Group
}

export function StepParticipants({ eventId, counts, groupType, onCountsRefresh, onNext, onBack }: StepParticipantsProps) {
  const [participants, setParticipants] = useState<ParticipantWithGroups[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const needsCountRefresh = useRef(false)
  const planLimits = usePlanLimitsFromCounts(counts, onCountsRefresh)

  const hasGroups = groupType === 'custom'

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [pRes, gRes] = await Promise.all([
        supabase
          .from('participants')
          .select('*, participant_groups(group_id, groups(*))')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true }),
        hasGroups
          ? supabase.from('groups').select('*').eq('event_id', eventId).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return

      const mapped: ParticipantWithGroups[] = (pRes.data ?? []).map((p) => ({
        ...p,
        groups: ((p.participant_groups as unknown as ParticipantGroupJoin[]) ?? []).map((pg) => pg.groups),
      }))

      setParticipants(mapped)
      setGroups((gRes.data as Group[]) ?? [])
      setError('')
      if (needsCountRefresh.current) {
        onCountsRefresh()
        needsCountRefresh.current = false
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [eventId, hasGroups, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (participants.length > prevCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
    prevCountRef.current = participants.length
  }, [participants.length])

  function refreshData() {
    setRefreshKey(k => k + 1)
  }

  function refreshDataWithCounts() {
    needsCountRefresh.current = true
    setRefreshKey(k => k + 1)
  }

  const handleDelete = useCallback(async (id: string) => {
    await supabase.from('participants').delete().eq('id', id)
    refreshDataWithCounts()
  }, [])

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
        refreshData()
      }
    })
  }, [groups])

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
        refreshData()
      }
    })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
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
        {/* Pinned top: counter + usage bar */}
        <div className="shrink-0 space-y-3 pb-3">
          {participants.length > 0 && (
            <p className="text-xs text-gray-400 text-center">
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

        {/* Scrollable list */}
        <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 space-y-2 pb-2 pl-1" style={{ scrollbarGutter: 'stable' }}>
          {participants.length === 0 ? (
            <EmptyState
              title="אין משתתפים עדיין"
              description="הקלידו שם משתתף ולחצו Enter"
            />
          ) : (
            participants.map((p) => (
              <MemoParticipantRow
                key={p.id}
                participant={p}
                groups={hasGroups ? groups : []}
                allGroups={groups}
                onDelete={handleDelete}
                onToggleGroup={handleToggleGroup}
                onSelectAllGroups={handleSelectAllGroups}
              />
            ))
          )}
        </div>

        {/* Pinned bottom: add input */}
        <div className="shrink-0 pt-2">
          <InlineAddParticipant
            eventId={eventId}
            onAdded={refreshDataWithCounts}
            onPlanLimit={() => setUpgradeOpen(true)}
            placeholder="הקלידו שם משתתף ולחצו Enter"
          />
        </div>
      </div>

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} limitType="participants" />
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
  const isAllSelected = groups.length > 0 && groups.every(g => memberGroupIds.has(g.id))

  return (
    <div className="flex items-center gap-3 rounded-xl border border-game-border bg-game-card p-3 transition-all hover:border-brand-700/50 group">
      <div className="min-w-0 flex-1" onClick={() => !editing && setEditing(true)} role="button" tabIndex={-1}>
        {editing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setName(participant.name); setEditing(false) } }}
            onBlur={saveName}
            autoFocus
            className="w-full bg-transparent text-sm font-medium text-white outline-none border-b border-brand-500 pb-0.5"
          />
        ) : (
          <span className="block w-full text-sm font-medium text-gray-200 hover:text-white transition-colors cursor-text truncate">
            {name}
          </span>
        )}
      </div>

      {groups.length > 0 && (
        <div className="shrink-0">
          <GroupSelectDropdown
            groups={groups}
            selectedGroupIds={memberGroupIds}
            allGroupsLabel="כל הקבוצות"
            tooltip="לאילו קבוצות שייך המשתתף"
            isAllSelected={isAllSelected}
            onSelectAll={() => onSelectAllGroups(participant.id, memberGroupIds, allGroups)}
            onToggleGroup={(groupId, isMember) => onToggleGroup(participant.id, groupId, isMember)}
          />
        </div>
      )}

      <button
        onClick={() => onDelete(participant.id)}
        className="shrink-0 p-1.5 rounded-lg text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
})
