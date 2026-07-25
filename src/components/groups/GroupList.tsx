import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { Layers, Lock, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ScrollContainer } from '@/components/ui/ScrollContainer'
import { ScrollableListLayout } from '@/components/ui/ScrollableListLayout'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { UpgradeModal } from '@/components/UpgradeModal'
import { RosterImportButton } from '@/components/roster/RosterImportButton'
import { RosterImportModal } from '@/components/roster/RosterImportModal'
import type { RosterImportResult } from '@/lib/roster/rosterImport'
import { GroupForm } from './GroupForm'
import { GroupCard } from './GroupCard'
import { InlineAddGroup } from './InlineAddGroup'
import { cn } from '@/lib/utils'
import { getLockedTemplate, LOCKED_TEMPLATE_CHANGED } from '@/lib/lockedTemplate'
import type { ActivityTemplateGroup, Group, GroupWithCount } from '@/types'

interface GroupListProps {
  eventId: string
  onCountChange: (count: number) => void
  embedded?: boolean
  header?: ReactNode
  /** A spreadsheet import finished - it also created the participants listed in it. */
  onImported?: (result: RosterImportResult) => void
}

function LockedGroupCard({ group }: { group: ActivityTemplateGroup }) {
  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-2xl bg-surface opacity-50 select-none">
        <div className="relative z-10 flex min-h-[8.5rem] flex-col items-center justify-center gap-2 px-4 py-5 text-center">
          <div className="pointer-events-none flex h-8 w-8 items-center justify-center rounded-xl bg-surface-elevated opacity-50 shadow-sm">
            <Lock size={16} className="text-muted" />
          </div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted">
            התנסות
          </div>
          <span className="w-full min-w-0 truncate text-xl font-bold leading-9 text-muted">
            {group.name}
          </span>
          <div className="flex justify-center">
            <span className="rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted">
              זמין באפשרויות הפעלה
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function GroupList({ eventId, onCountChange, embedded = false, header, onImported }: GroupListProps) {
  const [groups, setGroups] = useState<GroupWithCount[]>([])
  const [lockedGroups, setLockedGroups] = useState<ActivityTemplateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupWithCount | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<GroupWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [showAddInput, setShowAddInput] = useState(false)
  const [addInputFocusRequest, setAddInputFocusRequest] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)
  const prevCountRef = useRef(0)

  function revealAddInput() {
    setShowAddInput(true)
    setAddInputFocusRequest((n) => n + 1)
  }

  useEffect(() => {
    function syncLocked() {
      setLockedGroups(getLockedTemplate(eventId)?.groups ?? [])
    }
    syncLocked()
    window.addEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
    return () => window.removeEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
  }, [eventId])

  const loadGroups = useCallback(async (): Promise<GroupWithCount[] | null> => {
    const { data, error: fetchError } = await supabase
      .from('groups')
      .select('*, participant_groups(count)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return null
    }

    return (data ?? []).map((g) => ({
      ...g,
      member_count: (g.participant_groups as unknown as { count: number }[])?.[0]?.count ?? 0,
    }))
  }, [eventId])

  useEffect(() => {
    let cancelled = false
    loadGroups().then((mapped) => {
      if (cancelled || !mapped) return
      setGroups(mapped)
      onCountChange(mapped.length)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (groups.length > prevCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
    prevCountRef.current = groups.length
  }, [groups.length])

  useEffect(() => {
    if (groups.length === 0) {
      setShowAddInput(false)
    }
  }, [groups.length])

  useEffect(() => {
    if (showAddInput) {
      addInputRef.current?.focus()
    }
  }, [showAddInput, addInputFocusRequest])

  function handleAdded(group: Group) {
    setGroups((prev) => {
      const next = [...prev, { ...group, member_count: 0 }]
      onCountChange(next.length)
      return next
    })
  }

  async function handleImported(result: RosterImportResult) {
    const mapped = await loadGroups()
    if (mapped) {
      setGroups(mapped)
      onCountChange(mapped.length)
    }
    onImported?.(result)
  }

  function handleSaved(saved: Group) {
    handleFormClose()
    setGroups((prev) => {
      const exists = prev.some((g) => g.id === saved.id)
      if (exists) {
        return prev.map((g) => (
          g.id === saved.id ? { ...g, ...saved } : g
        ))
      }
      const next = [...prev, { ...saved, member_count: 0 }]
      onCountChange(next.length)
      return next
    })
  }

  function handleEdit(group: GroupWithCount) {
    setEditingGroup(group)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingGroup(null)
  }

  async function handleDelete() {
    if (!deletingGroup) return
    const deletedId = deletingGroup.id
    setDeleting(true)

    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', deletedId)

    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message)
      setDeletingGroup(null)
      return
    }

    setDeletingGroup(null)
    setGroups((prev) => {
      const next = prev.filter((g) => g.id !== deletedId)
      onCountChange(next.length)
      return next
    })
  }

  const usedGroupColors = groups.map((g) => g.color)

  if (loading) {
    return <CenteredLoader />
  }

  const hasLocked = lockedGroups.length > 0

  const emptyStateAction = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button size="sm" className="gap-1.5" onClick={revealAddInput}>
        <Plus size={16} className="shrink-0" strokeWidth={2.5} />
        הוסף קבוצה
      </Button>
      <RosterImportButton
        variant="button"
        label="ייבוא מקובץ"
        onClick={() => setImportOpen(true)}
      />
    </div>
  )

  const emptyStateDescription =
    'הוסיפו את הקבוצה הראשונה, או ייבאו מקובץ את המשתתפים והקבוצות שלהם.'

  // The import sits above the add field so the input stays pinned to the bottom.
  const footer = (
    <div className="space-y-2">
      <RosterImportButton
        label="ייבוא קבוצות ומשתתפים מקובץ"
        onClick={() => setImportOpen(true)}
      />
      <InlineAddGroup
        eventId={eventId}
        usedColors={usedGroupColors}
        onAdded={handleAdded}
        onPlanLimit={() => setUpgradeOpen(true)}
      />
    </div>
  )

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col', embedded && 'min-h-0')}>
      {!embedded && (
        <SectionHeader
          icon={<Layers size={18} className="text-tertiary-text" />}
          title="קבוצות"
          className="mb-4"
        />
      )}

      {error && (
        <ErrorAlert message={error} className="mb-4" />
      )}

      {groups.length === 0 && !hasLocked ? (
        embedded ? (
          <ScrollableListLayout
            className="flex-1 min-h-0"
            listRef={listRef}
            header={header}
            listClassName="py-1"
            footer={
              showAddInput ? (
                <InlineAddGroup
                  eventId={eventId}
                  usedColors={usedGroupColors}
                  onAdded={handleAdded}
                  onPlanLimit={() => setUpgradeOpen(true)}
                  nameInputRef={addInputRef}
                />
              ) : undefined
            }
          >
            <EmptyState
              compact
              icon={<Layers size={24} strokeWidth={1.75} className="text-tertiary-text" />}
              title="אין קבוצות עדיין"
              description={emptyStateDescription}
              action={emptyStateAction}
            />
          </ScrollableListLayout>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <ScrollContainer ref={listRef} stableGutter={false} className="flex-1 py-1 px-0">
              <EmptyState
                compact
                icon={<Layers size={24} strokeWidth={1.75} className="text-tertiary-text" />}
                title="אין קבוצות עדיין"
                description={emptyStateDescription}
                action={emptyStateAction}
              />
            </ScrollContainer>
            {showAddInput && (
              <div className="shrink-0">
                <InlineAddGroup
                  eventId={eventId}
                  usedColors={usedGroupColors}
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
          header={header}
          listClassName="space-y-3 py-1"
          footer={footer}
        >
          {groups.length > 0 && (
            <div className="grid grid-cols-1 items-stretch gap-4 px-1 py-1 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onEdit={() => handleEdit(group)}
                  onDelete={() => setDeletingGroup(group)}
                />
              ))}
            </div>
          )}

          {hasLocked && (
            <div className="grid grid-cols-1 items-stretch gap-4 px-1 py-1 sm:grid-cols-2 lg:grid-cols-3">
              {lockedGroups.map((group) => (
                <LockedGroupCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </ScrollableListLayout>
      ) : (
        <ScrollContainer ref={listRef} stableGutter={false} className="flex-1 space-y-3 py-1 px-0">
          {groups.length > 0 && (
            <div className="grid grid-cols-1 items-stretch gap-4 px-1 py-1 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onEdit={() => handleEdit(group)}
                  onDelete={() => setDeletingGroup(group)}
                />
              ))}
            </div>
          )}

          {hasLocked && (
            <div className="grid grid-cols-1 items-stretch gap-4 px-1 py-1 sm:grid-cols-2 lg:grid-cols-3">
              {lockedGroups.map((group) => (
                <LockedGroupCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </ScrollContainer>
      )}

      {!embedded && (groups.length > 0 || hasLocked) && (
        <div className="shrink-0">{footer}</div>
      )}

      {formOpen && (
        <GroupForm
          eventId={eventId}
          group={editingGroup ?? undefined}
          usedColors={usedGroupColors}
          isOpen={formOpen}
          onClose={handleFormClose}
          onSaved={handleSaved}
        />
      )}

      <Modal
        isOpen={!!deletingGroup}
        onClose={() => setDeletingGroup(null)}
        title="מחיקת קבוצה"
      >
        <p className="text-sm text-muted">
          האם אתם בטוחים שברצונכם למחוק את <strong className="text-foreground">{deletingGroup?.name}</strong>?
          כל שיוכי המשתתפים לקבוצה זו יוסרו גם כן. לא ניתן לבטל פעולה זו.
        </p>
        <ModalActions className="mt-4 pt-0">
          <Button variant="danger" loading={deleting} onClick={handleDelete}>
            מחיקה
          </Button>
          <Button variant="outline" onClick={() => setDeletingGroup(null)}>
            ביטול
          </Button>
        </ModalActions>
      </Modal>

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} eventId={eventId} />

      <RosterImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        eventId={eventId}
        context="groups"
        onImported={handleImported}
      />
    </div>
  )
}
