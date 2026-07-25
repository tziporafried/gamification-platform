import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { ScrollableListLayout } from '@/components/ui/ScrollableListLayout'
import { UpgradeModal } from '@/components/UpgradeModal'
import { RosterImportButton } from '@/components/roster/RosterImportButton'
import { RosterImportModal } from '@/components/roster/RosterImportModal'
import type { RosterImportResult } from '@/lib/roster/rosterImport'
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
  /** A spreadsheet import finished - it may also have created groups. */
  onImported?: (result: RosterImportResult) => void
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
  onImported,
}: ParticipantListProps) {
  const [participants, setParticipants] = useState<ParticipantWithGroups[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [showAddInput, setShowAddInput] = useState(false)
  const [addInputFocusRequest, setAddInputFocusRequest] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const addInputRef = useRef<HTMLInputElement>(null)
  // Latest participants, read inside stable callbacks without widening their deps.
  const participantsRef = useRef<ParticipantWithGroups[]>([])
  useEffect(() => { participantsRef.current = participants }, [participants])

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

  const loadGroups = useCallback(async () => {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    return (data as Group[]) ?? []
  }, [eventId])

  useEffect(() => {
    if (!hasGroups) {
      setGroups([])
      setParticipants((prev) => prev.map((p) => (p.groups.length > 0 ? { ...p, groups: [] } : p)))
      return
    }

    if (!isActive) return

    let cancelled = false
    loadGroups().then((data) => {
      if (!cancelled) setGroups(data)
    })
    return () => { cancelled = true }
  }, [hasGroups, isActive, loadGroups])

  // Coming back to this step re-reads the roster: an import on the groups step
  // can have added participants behind this list's back.
  const wasActiveRef = useRef(isActive)
  useEffect(() => {
    if (isActive && !wasActiveRef.current) loadParticipants(true)
    wasActiveRef.current = isActive
  }, [isActive, loadParticipants])

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
    // A participant must belong to at least one group - new participants default
    // to "all groups" so they're never left ungrouped.
    const defaultGroups = hasGroups ? groups : []
    setParticipants((prev) => {
      const next = [...prev, { ...participant, groups: defaultGroups }]
      onCountChange(next.length)
      return next
    })
    if (defaultGroups.length > 0) {
      supabase
        .from('participant_groups')
        .insert(defaultGroups.map((g) => ({ participant_id: participant.id, group_id: g.id })))
        .then(({ error: err }) => {
          if (err) {
            setError('שגיאה בשיוך המשתתף לקבוצות. הנתונים רועננו.')
            loadParticipants(true)
          }
        })
    }
  }, [onCountChange, hasGroups, groups, loadParticipants])

  const handleImported = useCallback(async (result: RosterImportResult) => {
    await loadParticipants(true)
    // The file may have introduced groups the dropdowns don't know about yet.
    if (result.groupsCreated > 0) setGroups(await loadGroups())
    onImported?.(result)
  }, [loadParticipants, loadGroups, onImported])

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

  // Ensure a participant is a member of every group ("all groups"). Only inserts
  // the memberships that are missing; never removes any.
  const assignAllGroups = useCallback((participantId: string, currentGroupIds: Set<string>) => {
    const missing = groups.filter((g) => !currentGroupIds.has(g.id))
    setParticipants((prev) => prev.map((p) => (
      p.id === participantId ? { ...p, groups: [...groups] } : p
    )))
    if (missing.length === 0) return
    supabase
      .from('participant_groups')
      .insert(missing.map((g) => ({ participant_id: participantId, group_id: g.id })))
      .then(({ error: err }) => {
        if (err) {
          setError('שגיאה בעדכון קבוצות. הנתונים רועננו.')
          loadParticipants(true)
        }
      })
  }, [groups, loadParticipants])

  const handleToggleGroup = useCallback((participantId: string, groupId: string, isMember: boolean) => {
    // A participant must always belong to at least one group. Removing their last
    // remaining group snaps the selection back to "all groups" instead of leaving
    // them ungrouped.
    if (isMember) {
      const participant = participantsRef.current.find((p) => p.id === participantId)
      if (participant && participant.groups.length <= 1) {
        assignAllGroups(participantId, new Set(participant.groups.map((g) => g.id)))
        return
      }
    }

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
  }, [groups, loadParticipants, assignAllGroups])

  // "All groups" always means membership in every group - it never clears the selection.
  const handleSelectAllGroups = useCallback((participantId: string, currentGroupIds: Set<string>) => {
    assignAllGroups(participantId, currentGroupIds)
  }, [assignAllGroups])

  if (loading) {
    return <CenteredLoader />
  }

  const participantList = participants.length > 0 && (
    <div className="space-y-1 px-1 py-0.5">
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

  const addField = (
    <InlineAddParticipant
      eventId={eventId}
      onAdded={handleAdded}
      onPlanLimit={() => setUpgradeOpen(true)}
      nameInputRef={addInputRef}
    />
  )

  // The import sits above the add field so the input stays pinned to the bottom.
  const footer = (
    <div className="space-y-2">
      <RosterImportButton label="ייבוא רשימה מקובץ" onClick={() => setImportOpen(true)} />
      {addField}
    </div>
  )

  const emptyState = (
    <EmptyState
      icon={<Users size={32} strokeWidth={1.75} />}
      title="אין משתתפים עדיין"
      description="הוסיפו את המשתתף הראשון, או ייבאו רשימה מוכנה מקובץ."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={revealAddInput}>
            <Plus size={16} className="shrink-0" strokeWidth={2.5} />
            הוסף משתתף
          </Button>
          <RosterImportButton
            variant="button"
            label="ייבוא מקובץ"
            onClick={() => setImportOpen(true)}
          />
        </div>
      }
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {error && <ErrorAlert message={error} className="shrink-0 mb-4" />}

      {participants.length === 0 ? (
        embedded ? (
          <ScrollableListLayout
            className="flex-1 min-h-0"
            listRef={listRef}
            footer={showAddInput ? addField : undefined}
          >
            {emptyState}
          </ScrollableListLayout>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
              {emptyState}
            </div>
            {showAddInput && <div className="shrink-0">{addField}</div>}
          </div>
        )
      ) : embedded ? (
        <ScrollableListLayout
          className="flex-1 min-h-0"
          listRef={listRef}
          listClassName="space-y-1"
          footer={footer}
        >
          {participantList}
        </ScrollableListLayout>
      ) : (
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 space-y-1">
            {participantList}
          </div>
          <div className="shrink-0">{footer}</div>
        </>
      )}

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} eventId={eventId} />

      <RosterImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        eventId={eventId}
        context="participants"
        groupsDisabled={!hasGroups}
        onImported={handleImported}
      />
    </div>
  )
}
