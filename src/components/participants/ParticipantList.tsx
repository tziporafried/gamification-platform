import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { ScrollableListLayout } from '@/components/ui/ScrollableListLayout'
import { UpgradeModal } from '@/components/UpgradeModal'
import { InlineAddParticipant } from './InlineAddParticipant'
import { ParticipantRow } from './ParticipantRow'
import type { Group, GroupType, Participant, ParticipantWithGroups } from '@/types'

interface ParticipantListProps {
  eventId: string
  groupType: GroupType | null
  isActive: boolean
  onCountChange: (count: number) => void
  /** Wizard step: list scrolls in parent; usage bar shares the same scroll width. */
  embedded?: boolean
}

interface ParticipantGroupJoin {
  group_id: string
  groups: Group
}

export function ParticipantList({
  eventId,
  groupType,
  isActive,
  onCountChange,
  embedded = false,
}: ParticipantListProps) {
  const [participants, setParticipants] = useState<ParticipantWithGroups[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [showAddInput, setShowAddInput] = useState(false)
  const [addInputFocusRequest, setAddInputFocusRequest] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const addInputRef = useRef<HTMLInputElement>(null)

  const hasGroups = groupType === 'custom'

  function revealAddInput() {
    setShowAddInput(true)
    setAddInputFocusRequest((n) => n + 1)
  }

  const loadParticipants = useCallback(async (syncCount = false) => {
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
    if (syncCount) onCountChange(mapped.length)
    return true
  }, [eventId, onCountChange])

  useEffect(() => {
    let cancelled = false
    async function init() {
      const ok = await loadParticipants(true)
      if (!cancelled && ok) setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [eventId])

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
  }, [eventId, hasGroups, isActive])

  useEffect(() => {
    if (participants.length > prevCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
    prevCountRef.current = participants.length
  }, [participants.length])

  useEffect(() => {
    if (participants.length === 0) {
      setShowAddInput(false)
    }
  }, [participants.length])

  useEffect(() => {
    if (showAddInput) {
      addInputRef.current?.focus()
    }
  }, [showAddInput, addInputFocusRequest])

  const handleAdded = useCallback((participant: Participant) => {
    setParticipants((prev) => {
      const next = [...prev, { ...participant, groups: [] }]
      onCountChange(next.length)
      return next
    })
  }, [onCountChange])

  const handleDelete = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from('participants').delete().eq('id', id)
    if (deleteError) {
      setError('שגיאה במחיקת משתתף.')
      return
    }
    setParticipants((prev) => {
      const next = prev.filter((p) => p.id !== id)
      onCountChange(next.length)
      return next
    })
  }, [onCountChange])

  const handleToggleGroup = useCallback((participantId: string, groupId: string, isMember: boolean) => {
    setParticipants((prev) => prev.map((p) => {
      if (p.id !== participantId) return p
      const newGroups = isMember
        ? p.groups.filter((g) => g.id !== groupId)
        : [...p.groups, groups.find((g) => g.id === groupId)!]
      return { ...p, groups: newGroups }
    }))

    const mutation = isMember
      ? supabase.from('participant_groups').delete().eq('participant_id', participantId).eq('group_id', groupId)
      : supabase.from('participant_groups').insert({ participant_id: participantId, group_id: groupId })

    mutation.then(({ error: err }) => {
      if (err) {
        setError('שגיאה בעדכון קבוצה. הנתונים רועננו.')
        loadParticipants(true)
      }
    })
  }, [groups, loadParticipants])

  const handleSelectAllGroups = useCallback((participantId: string, currentGroupIds: Set<string>, allGroups: Group[]) => {
    const isAllSelected = allGroups.length > 0 && allGroups.every((g) => currentGroupIds.has(g.id))
    const newGroups = isAllSelected ? [] : [...allGroups]

    setParticipants((prev) => prev.map((p) => {
      if (p.id !== participantId) return p
      return { ...p, groups: newGroups }
    }))

    const mutation = isAllSelected
      ? supabase.from('participant_groups').delete().eq('participant_id', participantId)
      : (() => {
          const missing = allGroups.filter((g) => !currentGroupIds.has(g.id))
          return missing.length > 0
            ? supabase.from('participant_groups').insert(missing.map((g) => ({ participant_id: participantId, group_id: g.id })))
            : Promise.resolve({ error: null })
        })()

    mutation.then(({ error: err }: { error: unknown }) => {
      if (err) {
        setError('שגיאה בעדכון קבוצות. הנתונים רועננו.')
        loadParticipants(true)
      }
    })
  }, [loadParticipants])

  if (loading) {
    return <CenteredLoader />
  }

  const participantList = participants.length > 0 && (
    <div className="space-y-2 px-1 py-0.5">
      {participants.map((p) => (
        <ParticipantRow
          key={p.id}
          participant={p}
          groups={hasGroups ? groups : []}
          allGroups={groups}
          onDelete={handleDelete}
          onToggleGroup={handleToggleGroup}
          onSelectAllGroups={handleSelectAllGroups}
          onError={setError}
        />
      ))}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {error && <ErrorAlert message={error} className="shrink-0 mb-4" />}

      {participants.length === 0 ? (
        embedded ? (
          <ScrollableListLayout
            className="flex-1 min-h-0"
            listRef={listRef}
            footer={
              showAddInput ? (
                <InlineAddParticipant
                  eventId={eventId}
                  onAdded={handleAdded}
                  onPlanLimit={() => setUpgradeOpen(true)}
                  nameInputRef={addInputRef}
                />
              ) : undefined
            }
          >
            <EmptyState
              icon={<Users size={32} strokeWidth={1.75} />}
              title="אין משתתפים עדיין"
              description="הוסיפו את המשתתף הראשון"
              action={
                <Button size="sm" className="gap-1.5" onClick={revealAddInput}>
                  <Plus size={16} className="shrink-0" strokeWidth={2.5} />
                  הוסף משתתף
                </Button>
              }
            />
          </ScrollableListLayout>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
              <EmptyState
                icon={<Users size={32} strokeWidth={1.75} />}
                title="אין משתתפים עדיין"
                description="הוסיפו את המשתתף הראשון"
                action={
                  <Button size="sm" className="gap-1.5" onClick={revealAddInput}>
                    <Plus size={16} className="shrink-0" strokeWidth={2.5} />
                    הוסף משתתף
                  </Button>
                }
              />
            </div>
            {showAddInput && (
              <div className="shrink-0">
                <InlineAddParticipant
                  eventId={eventId}
                  onAdded={handleAdded}
                  onPlanLimit={() => setUpgradeOpen(true)}
                  nameInputRef={addInputRef}
                />
              </div>
            )}
          </div>
        )
      ) : embedded ? (
        <ScrollableListLayout
          className="flex-1 min-h-0"
          listRef={listRef}
          listClassName="space-y-2"
          footer={
            <InlineAddParticipant
              eventId={eventId}
              onAdded={handleAdded}
              onPlanLimit={() => setUpgradeOpen(true)}
              nameInputRef={addInputRef}
            />
          }
        >
          {participantList}
        </ScrollableListLayout>
      ) : (
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 space-y-2">
            {participantList}
          </div>
          <div className="shrink-0">
            <InlineAddParticipant
              eventId={eventId}
              onAdded={handleAdded}
              onPlanLimit={() => setUpgradeOpen(true)}
              nameInputRef={addInputRef}
            />
          </div>
        </>
      )}

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} eventId={eventId} />
    </div>
  )
}
